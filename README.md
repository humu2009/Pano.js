Welcome to Pano.js
==================

The aim of this project is to provide a fast and lightweight library that helps to display online panorama scene. Pano.js is based upon Javascript and HTML5 technology. It uses WebGL for efficient hardware accelerated display. For older browsers where WebGL is not available, a canvas 2D rendering backend will be enabled as a fallback.

How to
------

Pano.js can be easily integrated into online applications. The simplest usage only requires a single line:

    var view = new Pano.View( canvas_tag, { equirectangular: 'my_panorama.jpg' } );

which creates an instance of `Pano.View`, and then loads a panorama image and displays it on a given canvas element.

Live Examples
-------------

[![chapel demo](https://raw.github.com/humu2009/Pano.js/master/screenshots/chapel.jpg)](http://humu2009.github.io/Pano.js/examples/basic.html)
[![station demo](https://raw.github.com/humu2009/Pano.js/master/screenshots/station.jpg)](http://humu2009.github.io/Pano.js/examples/software_rendering.html)
[![iphone demo](https://raw.github.com/humu2009/Pano.js/master/screenshots/iphone.jpg)](http://humu2009.github.io/Pano.js/examples/css3d.html)
[![square demo](https://raw.github.com/humu2009/Pano.js/master/screenshots/square.jpg)](http://humu2009.github.io/Pano.js/examples/labeling.html)

API Document
---

The library exposes only a single class `Pano.View` whose interface is kept as explicit as possible for use.

    Pano.View(canvas, options)

Constructor to create a new instance of `Pano.View` on a given canvas with optional parameters.
* _canvas_ - A canvas element on which to create the view instance.
* _options_ - A wrapper object holding a series of optional parameters.

After `Pano.View` has been instantiated, the following method can be involked on it to manipulate the panorama and the view.

    view.load(url, reset)

Set the URL of a new panarama image that will be loaded in.
* _url_ - The URL of the panorama image to load.
* _reset_ - Whether to reinitialize the view when the new panorama image is loaded and applied. Default to _false_.


    view.reset()

Reset the view to its initial state. If it is in navigation mode, the navigation will be cancelled immediately.

    view.yaw(degs)

Rotate the view a given angle along the horizontal axis.
* _degs_ - Degrees to rotate.


    view.pitch(degs)

Rotate the view a given angle along the vertical axis.

    view.zoom(degs)

Zoom in/out the view by changing the field of view a given degrees.

    view.jumpTo(heading, pitch, fov)

Move the view to be aiming at a new position with new zoom factor given by the heading and pitch angles and the fov value. The change is applied immediately without approaching animation.

    view.navigateTo(heading, pitch, fov, duration, callbackOnArrival, easingFn)

Similar to `jumpTo` except that it starts a navigation to the new position and zoom factor using animation.

    view.playTour(path)

Start a tour along the path defined by a given series of nodes.

    view.addLabel(innertHTML, heading, pitch, isInteractive, frameOptions, callbackOnLayout)

Add a label on a given position of the panorama.

    view.addLensFlare(flareImgURLs, heading, pitch, range, scales)

Add a group of lens flare effect on a given position of the panorama.

    view.eulerToView(heading, pitch)

Utility method. Given a position by the heading and pitch angles, it returns the coordinates on the canvas.

    view.viewToEuler(x, y)

Utility method. Given the coordinates on the canvas, it returns the equivelant heading and pitch angles.

    view.maximize()

Resize the view/canvas to fill the client area of the browser.

    view.restore()

Restore the view/canvas to its original position and size.

    view.saveScreenshot(basename, format, quality)

Take a screenshot of the view and save it as an image file with the given name, format and expected quality.
