// Get the hash of the url
const hash = window.location.hash
.substring(1)
.split('&')
.reduce(function (initial, item) {
  if (item) {
    var parts = item.split('=');
    initial[parts[0]] = decodeURIComponent(parts[1]);
  }
  return initial;
}, {});
window.location.hash = '';

// Set token
let g_token = hash.access_token;
let g_deviceId;
let g_playlistcount = 0;
let g_playlistIds = [];
let g_playlistName = '';
console.log('fork', g_token);
if(getCookie() != '' || !g_token) {
  g_token = getCookie();
} else {
  setCookie(g_token,hash.expires_in);
}

const authEndpoint = 'https://accounts.spotify.com/authorize';

// Replace with your app's client ID, redirect URI and desired scopes
const clientId = 'YOUR_TOKEN';
const redirectUri = 'https://shufflefy.glitch.me';
const scopes = [
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state'
];

// If there is a token, show the approved state, not the un-approved state
if (g_token) {
  $('.not-approved').addClass('d-none');
  $('.approved').removeClass('d-none');
}

// Set up the Web Playback SDK

window.onSpotifyPlayerAPIReady = () => {
  const player = new Spotify.Player({
    name: 'Web Playback SDK Template',
    getOAuthToken: cb => { cb(g_token); }
  });

  // Error handling
  player.on('initialization_error', e => console.error(e));
  player.on('authentication_error', e => console.error(e));
  player.on('account_error', e => console.error(e));
  player.on('playback_error', e => console.error(e));

  // Playback status updates
  player.on('player_state_changed', state => {
    //console.log(state);
    
    //if the song is done, lets get the next one rollin'
    if (this.state && state.track_window.previous_tracks.find(x => x.id === state.track_window.current_track.id) && !this.state.paused && state.paused) {
      playNextSong();
    }
    this.state = state;
    
    let artistsArr = state.track_window.current_track.artists.map(artist => artist.name);
    let artists = artistsArr.join(', ');
    $('#current-track').attr('src', state.track_window.current_track.album.images[0].url);
    $('#current-track-name').text(state.track_window.current_track.name);
    $('#current-artist-name').text(artists);
    $('#current-album-name').text(state.track_window.current_track.album.name);
  });

  // Ready
  player.on('ready', data => {
    //console.log('Ready with Device ID', data.device_id);
    g_deviceId = data.device_id;
    getDevices();
    
    getPlaylists('https://api.spotify.com/v1/me/playlists?limit=50', true);
  });

  // Connect to the player!
  player.connect();
}



//==========================
// Spotify Playback Tools
//==========================

// Play a specified track on the Web Playback SDK's device ID
function play(_nextTrack = "") {
  $.ajax({
   url: "https://api.spotify.com/v1/me/player/play?device_id=" + g_deviceId,
   type: "PUT",
   data: '{"uris": ["' + _nextTrack + '"]}',
   beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + g_token );},
   success: function(data) { 
     //whatever
   }
  });
}



//==========================
// Spotify API calls
//==========================

function getLibraryTracks(_libraryTracksAPICall) {
  $.ajax({
    url: _libraryTracksAPICall,
    type: "GET",
    beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + g_token );},
    success: function(data) { 
      
      console.log('LT',data);
    }
  });
}

function getPlaylists(_playlistAPICall, _firstTime = false, _nextTrackNumber = -1) {
  $.ajax({
    url: _playlistAPICall,
    type: "GET",
    beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + g_token );},
    success: function(data) { 

      if(_firstTime) {
        g_playlistcount = data.total;

        let newIds = data.items.map(playlist => playlist.id);
        g_playlistIds = g_playlistIds.concat(newIds);

        if(data.next) {
          getPlaylists(data.next, true);
        } else {
          $('.approved').removeClass('loading');
        }
      } else {
        
        let total = (data.tracks) ? data.tracks.total : data.total;
        if(total <= 0) {
          //cant play tracks what dont exist
          getPlaylists(_playlistAPICall);
          return;
        }
        
        let next = (data.tracks) ? data.tracks.next : data.next;
        let nextTrackNumber = (_nextTrackNumber == -1) ? Math.floor(Math.random() * total) : _nextTrackNumber;

        if(nextTrackNumber >= 100) {
          //if its greater than 100 it wont be in the array
          console.log('>100',nextTrackNumber);
          getPlaylists(next, false, nextTrackNumber-100);
          return;
          
        }
        let trackURI = (data.tracks) ? data.tracks.items[nextTrackNumber].track.uri : data.items[nextTrackNumber].track.uri;

        if (trackURI.indexOf('local') >= 0) {
          //if its a local file we can't play it
          getPlaylists(_playlistAPICall);
          return;
          
        } else {
          play(trackURI);
        }
        
        if(data.name) {
          g_playlistName = data.name;
        }
        
        $('#current-playlist-source').text('Playlist: ' + g_playlistName);
      }
    }
  });
}

function getDevices() {
  $.ajax({
   url: "https://api.spotify.com/v1/me/player/devices",
   type: "GET",
   beforeSend: function(xhr){xhr.setRequestHeader('Authorization', 'Bearer ' + g_token );},
   success: function(data) { 
     data.devices.forEach((device) => {

       if(!device.is_restricted) {
         $('#device-options').append('<option value="' + device.id + '">' + device.name + '</option>')
       }
     });
     
     $('#device-options').val(g_deviceId);
   }
  });
}






//==========================
// User Interactions
//==========================

function allowAccess() {
  window.location = `${authEndpoint}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes.join('%20')}&response_type=token&show_dialog=true`;
}

function playNextSong() {
  let playlistNumber = Math.floor(Math.random() * g_playlistcount); 
  console.log(playlistNumber);
  
  $('.btn.btn-primary').html('Next');
  
  if(playlistNumber > 0) {
    //from a playlist
    getPlaylists('https://api.spotify.com/v1/playlists/' + g_playlistIds[playlistNumber]);
  } else {
    //from library
  }
}

function changeDevice(_ev) {
  g_deviceId = $('#device-options').val();
}


//==========================
// Utility functions
//==========================

function setCookie(_tokenId, _expiry) {
  document.cookie = 'SpotifyToken' + "=" + _tokenId + ";max-age=" + _expiry + ";path=/";
}

function getCookie() {
  var name = 'SpotifyToken' + "=";
  var decodedCookie = decodeURIComponent(document.cookie);
  var ca = decodedCookie.split(';');
  for(var i = 0; i <ca.length; i++) {
    var c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      g_token = c.substring(name.length, c.length);
      return c.substring(name.length, c.length);
    }
  }
  return "";
}