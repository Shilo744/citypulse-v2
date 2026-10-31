@echo off
rem Starts CityPulse V2 and opens it in the browser. Close this window to stop the server.
rem If the page does not open, the server may already be running: browse to http://localhost:8800
cd /d "%~dp0"
start "" http://localhost:8800
node server.js
