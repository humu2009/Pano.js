Welcome to Pano.js
==================

The aim of this project is to provide a fast and lightweight library that helps to display online panorama scene. Pano.js is based upon Javascript and HTML5 technology. It uses WebGL for efficient hardware accelerated display. For older browsers where WebGL is not available, a canvas 2D rendering backend will be enabled as a fallback.

How to
------

Pano.js can be easily integrated into online applications. The simplest usage only requires a single line:

```js
var view = new Pano.View( canvas_tag, { equirectangular: 'my_panorama.jpg' } );
```

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

```
Pano.View(canvas, options)
```

Constructor to create a new instance of `Pano.View` on a given canvas with optional parameters.
* `canvas` - A canvas element on which to create the view instance.
* `options` - A wrapper object holding a series of optional parameters, including:
  * `heading` - The initial heading angle of the view. Default to _90_.
  * `pitch` - The initial pitch angle of the view. Default to _90_.
  * `fov` - The initial field of view angle. Default to _90_.
  * `rendering` - Suggests the rendering method to use. This can be _'webgl'_ or _'software'_. Default to _'webgl'_ if WebGL is available on the browser.
  * `inertial` - Set this to _'on'_ or _'off'_ to turn on/off inertial move. Default to _'on'_.
  * `filtering` - Whether and when to activate filtering to gain better image quality. This can be _'on'_, _'off'_ or _'on-idle'_. Default to _'on-idle'_.

After `Pano.View` has been instantiated, the following method can be involked on it to manipulate the panorama and the view.

```
view.load(url, reset)
```

Set the URL of a new panarama image that will be loaded in.
* `url` - The URL of the panorama image to load.
* `reset` - Whether to reinitialize the view when the new panorama image is loaded and applied. Default to _false_. 

```
view.reset()
```

Reset the view to its initial state. If it is in navigation mode, the navigation will be cancelled immediately.

```
view.yaw(degs)
```

Rotate the view a given angle along the horizontal axis.
* `degs` - Degrees to rotate.

```
view.pitch(degs)
```

Rotate the view a given angle along the vertical axis.
* `degs` - Degrees to rotate.

```
view.zoom(degs)
```

Zoom in/out the view by changing the field of view a given degrees.
* `degs` - Degrees to zoom in/out.

```
view.jumpTo(heading, pitch, fov)
```

Move the view to be aiming at a new position with new zoom factor given by the heading and pitch angles and the fov value. The change is applied immediately without approaching animation.
* `heading` - The heading angle in degrees to jump to. Default to current angle.
* `pitch` - The pitch angle in degrees to jump to. Default to current angle.
* `fov` - The fov angle in degrees to jump to, which specifies the zoom factor. Default to current angle.

```
view.navigateTo(heading, pitch, fov, duration, callbackOnArrival, easingFn)
```

Similar to `jumpTo` except that it starts a navigation to the new position and zoom factor using animation.
* `heading` - The heading angle in degrees to navigate to. Default to current angle.
* `pitch` - The pitch angle in degrees to navigate to. Default to current angle.
* `fov` - The fov angle in degrees to navigate to. Default to current angle.
* `duration` - Time length in milliseconds after which the target position is reached. Default to _2000_.
* `callbackOnArrival` - A function that will be invoked at the end of the navigation. Default to _null_.
* `easingFn` - Specifies the interpolation method used to smooth the animation. Default to _'Quadratic.InOut'_.

```
view.playTour(path)
```

Start a tour along the path defined by a given series of nodes.
* `path` - An array which contains a series of nodes defining the path of the tour. Each node should be an object specifying the node's position and an optional action:
  * `heading` - The heading angle in degrees that specifies the position of the node.
  * `pitch` - The pitch angle in degrees that specifies the position of the node.
  * `fov` - The fov angle in degrees that specifies the zoom factor on the node.
  * `duration` - Time length in milliseconds of the animation between the node and the next node.
  * `hoverTime` - Time length in milliseconds to hover on the node.
  * `onArrival` - A function that will be called when the node is reached.

On implementation level, `navigateTo` is used to navigate between each node.

```
view.addLabel(innertHTML, heading, pitch, isInteractive, frameOptions, callbackOnLayout)
```

Add a label on a given position of the panorama.
* `innerHTML` - 
* `heading` - 
* `pitch` - 
* `isInteractive` - 
* `frameOptions` - 
* `callbackOnLayout` - 

An example of labeling can be found [here](https://github.com/humu2009/Pano.js/blob/master/examples/labeling.html).

```
view.addLensFlare(flareImgURLs, heading, pitch, range, scales)
```
* `flareImgURLs` - 
* `heading` - 
* `pitch` - 
* `range` - 
* `scales` - 

An example of adding lens flares can be found [here](https://github.com/humu2009/Pano.js/blob/master/examples/software_rendering.html).

Add a group of lens flare effect on a given position of the panorama.

```
view.eulerToView(heading, pitch)
```

Utility method. Given a position by the heading and pitch angles, it returns the (x, y) coordinates on the canvas.
* `heading` - The heading angle in degrees.
* `pitch` - The pitch angle in degrees.

```
view.viewToEuler(x, y)
```

Utility method. Given the coordinates on the canvas, it returns the equivelant heading and pitch angles.
* `x` - X coordinate on canvas in pixels.
* `y` - Y coordinate on canvas in pixels.

```
view.maximize()
```

Resize the view/canvas to fill the client area of the browser.

```
view.restore()
```

Restore the view/canvas to its original position and size.

An example that demonstrates the useage of `maximize` and `restore` can be found [here](https://github.com/humu2009/Pano.js/blob/master/examples/basic.html).

```
view.saveScreenshot(basename, format, quality)
```

Take a screenshot of the view and save it as an image file with the given name, format and expected quality.
* `basename` - File name of the result. Default to _'screenshot'_.
* `format` - Image format to save as. This can be _'jpeg'_, _'png'_, or _'gif'_. Default to _'jpeg'_.
* `quality` - Expected quality if the specified format uses lossy compression. Default to _0.8_.
