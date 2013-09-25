Welcome to Pano.js
==================

The aim of this project is to provide a fast and lightweight library that helps to display online panorama scene. Pano.js is based upon Javascript and HTML5 technology. It uses WebGL for efficient hardware accelerated display. For older browsers where WebGL is not available, a canvas 2D rendering backend will be enabled as a fallback.

How to
------

Pano.js can be easily integrated into online applications. The simplest usage only requires a single line:

    var view = new Pano.View(canvas_tag, {equirectangular: 'my_panorama.jpg'});

This creates an instance of `Pano.View`, then loads a panorama image and displays it in a given canvas element.

Live Examples
-------------

[![chapel demo](https://raw.github.com/humu2009/Pano.js/master/screenshots/chapel.jpg)](http://humu2009.github.io/Pano.js/examples/basic.html)
[![station demo](https://raw.github.com/humu2009/Pano.js/master/screenshots/station.jpg)](http://humu2009.github.io/Pano.js/examples/software_rendering.html)
[![iphone demo](https://raw.github.com/humu2009/Pano.js/master/screenshots/iphone.jpg)](http://humu2009.github.io/Pano.js/examples/css3d.html)
[![square demo](https://raw.github.com/humu2009/Pano.js/master/screenshots/square.jpg)](http://humu2009.github.io/Pano.js/examples/labeling.html)
