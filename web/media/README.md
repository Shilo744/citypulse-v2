# Preview video of the entry page

`citypulse-preview.mp4` (about 20 MB, English narration, 2:55), `citypulse-preview.en.vtt` (English captions) and `citypulse-preview.jpg` (poster) are played by `web/js/product/entry/video.js`.
The mp4 is not kept in git (it changes with every cut); it is deployed from the working tree with the rest of `web/`.
To play the video from YouTube instead, set `VIDEO.youtube` in `web/js/product/config.js` to the id: the address of the site stays the same.
