// offscreen.js
chrome.runtime.onMessage.addListener(message => {
  if (message.type === 'playAudio') {
    const audio = new Audio(message.src);
    audio.play();
  }
});