# Food photos

Photos for the food portfolio at `/food/` on this site.
Every image in this folder appears there automatically.

Add photos with the script, never by copying them in:

    npm run food:add -- ~/Downloads/IMG_1234.jpg --name "Cacio e pepe" --date none

It strips the GPS location and other metadata (this repo is public), fixes the
rotation and saves the file as `cacio-e-pepe.jpg` (or `YYYY-MM-DD-name.jpg`
without `--date none`). To replace a photo with a better original, add it with
the same `--name` and delete the old file first.

In `src/data/food.json`, give each photo a title, a one-line note and alt text.
Photos listed there appear first, in that order; any others follow, newest first.
The build, `npm run qa` and every commit fail if any image in the repo still
carries metadata (`npm run photos:check` runs the same check).
