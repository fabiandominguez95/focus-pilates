#!/bin/bash
set -e
cd "$(dirname "$0")"
ESB=$( [ -x node_modules/.bin/esbuild ] && echo node_modules/.bin/esbuild || echo /opt/npm-tools/node_modules/esbuild/bin/esbuild )
rm -rf dist && mkdir dist
$ESB src/main.tsx --bundle --minify --target=es2020 --jsx=automatic --define:process.env.NODE_ENV=\"production\" --outfile=dist/app.js --loader:.css=css --log-level=warning
cp public/* dist/
# esbuild emite app.css junto a app.js por el import de styles.css
ls dist
