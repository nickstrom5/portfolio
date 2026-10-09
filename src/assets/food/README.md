# Food photos

Photos for the unlisted page at https://work-with-nick.com/food/. Every image in
this folder appears there automatically, newest first.

Add photos with the script, never by copying them in:

    npm run food:add -- ~/Downloads/IMG_1234.jpg --name "Cacio e pepe"

It strips the GPS location and other metadata (this repo is public), fixes the
rotation and saves the file as `YYYY-MM-DD-name.jpg`. The name becomes the
caption; override captions or alt text in `src/data/food.json`. `npm run qa`
fails if a photo here still carries metadata.
