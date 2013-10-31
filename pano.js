/**
 * @preserve Copyright (c) 2013 Humu <humu2009@gmail.com>
 * Pano.js can be freely distributed under the terms of the MIT license.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */


var Pano = Pano || {};


(function() {

	var DEG2RAD = Math.PI / 180;
	var RAD2DEG = 180 / Math.PI;

	/**
	 *	Collect platform and browser info.
	 */
	var is_touch_device = window.createTouch != undefined;
	var is_canvas_available = window.HTMLCanvasElement != undefined;
	var is_webgl_available = window.WebGLRenderingContext != undefined;
	var is_firefox = /Firefox[\/\s]\d+(?:.\d+)*/.test(window.navigator.userAgent);
	var is_opera = /Opera[\/\s]\d+(?:.\d+)*/.test(window.navigator.userAgent);

	var requestAnimationFrame = window.requestAnimationFrame || function(callback) {
		setTimeout(callback, 17);
	};

	var new_label_id = 0;
	var label_layer_style = null;
	var default_label_style = null;

	var util_canvas = null;

	var screenshot_helper = null;
	var screenshot_method = 'unknown';

	var label_style_template =	'.label-frame { \n' + 
								'	position:absolute; \n' + 
								'	width:200px; \n' + 
								'	padding:8px; \n' + 
								'	border:3px solid #5a8f00; \n' + 
								'	font:1em/1.4 Cambria, Georgia, sans-serif; \n' + 
								'	color:#333; \n' + 
								'	background:#fff; \n' + 
								'	text-align:left; \n' + 
								'	-webkit-border-radius:10px; \n' + 
								'	-moz-border-radius:10px; \n' + 
								'	-o-border-radius:10px; \n' + 
								'	-ms-border-radius:10px; \n' + 
								'	border-radius:10px; \n' + 
								'	-webkit-user-select:none; \n' + 
								'	-moz-user-select:none; \n' + 
								'	-o-user-select:none; \n' + 
								'	-ms-user-select:none; \n' + 
								'	user-select:none; \n' + 
								'	pointer-events:none; \n' + 
								'}';

	var label_layer_style_template =	'.label-layer { \n' + 
										'	position:absolute; \n' + 
										'	overflow:hidden; \n' + 
										'	pointer-events:none; \n' + 
										'}\n' + 
										/*
										 *	For Opera 9.x ~ 12.x which does not support CSS pointer-events. 
										 *	See http://caniuse.com/pointer-events and
										 *	http://www.opera.com/docs/specs/presto2.12/css/o-vendor/.
										 */
										'x:-o-prefocus, .label-layer { \n' + 
										'	visibility: hidden; \n' + 
										'}';

	var equirectangular_vs =	'#ifdef GL_ES \n' + 
								'	precision mediump float; \n' + 
								'#endif	\n' + 
								'attribute vec2 a_position; \n' + 
								'varying vec2 v_fraction; \n' + 
								'void main(void) { \n' + 
								'	v_fraction = vec2(0.5, -0.5) * a_position + vec2(0.5, 0.5); \n' + 
								'	gl_Position = vec4(a_position, 0.0, 1.0); \n' + 
								'}';
	var equirectangular_fs =	'#ifdef GL_ES \n' + 
								'	precision mediump float; \n' + 
								'#endif	\n' + 
								'#define PI 3.1415927 \n' + 
								'uniform vec3 u_camUp; \n' + 
								'uniform vec3 u_camRight; \n' + 
								'uniform vec3 u_camPlaneOrigin; \n' + 
								'uniform sampler2D s_texture; \n' + 
								'varying vec2 v_fraction; \n' + 
								'void main(void) { \n' + 
								'	vec3 ray = u_camPlaneOrigin + v_fraction.x * u_camRight - v_fraction.y * u_camUp; \n' + 
								'	ray = normalize(ray); \n' + 
								'	float theta = acos(ray.y) / PI; \n' + 
								'	float phi = 0.5 * (atan(ray.z, ray.x) + PI) / PI; \n' + 
								'	gl_FragColor = texture2D(s_texture, vec2(phi, theta)); \n' + 
								'}';

	var sprite_vs =	'#ifdef GL_ES \n' + 
					'	precision mediump float; \n' + 
					'#endif	\n' + 
					'uniform vec2 u_anchor; \n' + 
					'uniform vec2 u_size; \n' + 
					'attribute vec2 a_position; \n' + 
					'varying vec2 v_texcoord; \n' + 
					'void main(void) { \n' + 
					'	v_texcoord = vec2(0.5, -0.5) * a_position + vec2(0.5, 0.5); \n' + 
					'	gl_Position = vec4(u_anchor + u_size * a_position, 0.0, 1.0); \n' + 
					'}';
	var sprite_fs =	'#ifdef GL_ES \n' + 
					'	precision mediump float; \n' + 
					'#endif	\n' + 
					'uniform float u_alpha; \n' + 
					'uniform sampler2D s_texture; \n' + 
					'varying vec2 v_texcoord; \n' + 
					'void main(void) { \n' + 
					'	gl_FragColor = u_alpha * texture2D(s_texture, v_texcoord); \n' + 
					'}';

	function clamp(val, min, max) {
		return Math.max(min, Math.min(max, val));
	}

	function makeSFVec() {
		return window.Float32Array ? (new window.Float32Array(arguments)) : Array.prototype.slice.call(arguments, 0);
	}

	function eulerToQuat(heading, pitch) {
		var halfHeadingRads = 0.5 * heading * DEG2RAD;
		var halfPitchRads = 0.5 * (pitch - 90) * DEG2RAD;

		var ch = Math.cos(halfHeadingRads);
		var sh = Math.sin(halfHeadingRads);
		var cp = Math.cos(halfPitchRads);
		var sp = Math.sin(halfPitchRads);

		return [ch*sp, sh*cp, -sh*sp, ch*cp];
	}

	function quatToEuler(x, y, z, w) {
		var sp = -2 * (y * z - w * x);
		// floating point error may result in invalid inputs for asin()
		sp = clamp(sp, -1, 1);

		var pitch = Math.asin(sp) * RAD2DEG;
		var heading = Math.atan2(x * z + w * y, 0.5 - x * x - y * y) * RAD2DEG;

		return [heading, pitch+90];
	}

	function intersectRects(r0, r1) {
		var left   = Math.max(r0.left, r1.left);
		var top    = Math.max(r0.top, r1.top);
		var right  = Math.min(r0.right, r1.right);
		var bottom = Math.min(r0.bottom, r1.bottom);
		return {
			left:   left, 
			top:    top, 
			right:  right, 
			bottom: bottom, 
			width:  right-left, 
			height: bottom-top
		};
	}

	function isPowerOfTwo(n) {
		return (n & (n - 1)) == 0;
	}

	function getScriptPath(name, ignoreCase) {
		var searchPattern = new RegExp('/' + name + '$', ignoreCase ? 'i' : '');
		var scripts = document.getElementsByTagName("script");
		for (var i=0; i<scripts.length; i++) {
			var index = scripts[i].src.search(searchPattern);
			if (index >= 0) {
				return scripts[i].src.substring(0, index + 1);
			}
		}
		return null;
	}

	function addCSSStyle(template) {
		var cssStyle = document.createElement('style');
		cssStyle.type = 'text/css';
		cssStyle.innerHTML = template;
		document.getElementsByTagName('head')[0].appendChild(cssStyle);
		return cssStyle;
	}

	function getUtilCanvas(width, height, clear) {
		var isClean = false;
		if (!util_canvas) {
			util_canvas = document.createElement('canvas');
			isClean = true;
		}

		if (!util_canvas)
			return null;

		if (util_canvas.width != width || util_canvas.height != height) {
			util_canvas.width = width;
			util_canvas.height = height;
			isClean = true;
		}

		if (!isClean && clear != false) {
			var ctx = util_canvas.getContext('2d');
			ctx.clearRect(0, 0, width, height);
		}

		return util_canvas;
	}

	function generateImageFromCanvas(canvas) {
		var img = new Image;
		try {
			img.src = canvas.toDataURL();
		}
		catch (e) {
		}		
		return img;
	}

	function getDataURLFromCanvas(canvas, type, quality) {
		type = type || 'image/png';
		/*
		 * It seems Firefox's implementation does not like the 2nd argument for toDataURL() which 
		 * specifies an expected quality level. A security error will occur if it is set.  See 
		 * https://bugzilla.mozilla.org/show_bug.cgi?id=564388 for more details.
		 */
		return is_firefox ? canvas.toDataURL(type) : canvas.toDataURL(type, quality || 0.8);
	}

	function getWebGL(canvas) {
		var ctx3dNames = ['webgl', 'experimental-webgl'];
		for (var i=0; i<ctx3dNames.length; i++) {
			try {
				var gl = canvas.getContext(ctx3dNames[i]);
				if (gl)
					return gl;
			}
			catch (e) {
			}
		}
		return null;
	}

	function createProgram(gl, vsource, fsource) {
		var vShader = gl.createShader(gl.VERTEX_SHADER);
		gl.shaderSource(vShader, vsource);
		gl.compileShader(vShader);
		if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) {
			console.info(gl.getShaderInfoLog(vShader));
			throw 'Vertex shader compilation error';
		}

		var fShader = gl.createShader(gl.FRAGMENT_SHADER);
		gl.shaderSource(fShader, fsource);
		gl.compileShader(fShader);
		if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) {
			console.info(gl.getShaderInfoLog(fShader));
			throw 'Fragment shader compilation error';
		}

		var program = gl.createProgram();
		gl.attachShader(program, vShader);
		gl.attachShader(program, fShader);
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			console.info(gl.getProgramInfoLog(program));
			throw 'Program linking error';
		}

		return program;
	}


	/**
		@class View
	 */
	function View(canvas, params) {
		this.canvas = (typeof canvas) == 'string' ? document.getElementById(canvas) : canvas;

		this.init_heading = 90;
		this.init_pitch = 90;
		this.init_fov = 90;

		this.inertial_move = 'on';
		this.image_filtering = 'on-idle';

		this.img = null;
		this.is_loading = false;
		this.is_loaded = false;

		this.labels = [];
		this.label_layer = null;

		this.lensFlares = [];
		this.flareImgs = {};

		var forceWebGLRendering = false;
		var forceSoftwareRendering = false;
		if (params) {
			if ((typeof params['heading']) == 'number')
				this.init_heading = params['heading'];
			if ((typeof params['pitch']) == 'number')
				this.init_pitch = clamp(params['pitch'], 0, 180);
			if ((typeof params['fov']) == 'number')
				this.init_fov = clamp(params['fov'], 30, 90);
			if (params['rendering'] == 'webgl')
				forceWebGLRendering = true;
			else if (params['rendering'] == 'software')
				forceSoftwareRendering = true;
			if ((typeof params['inertial'] == 'string'))
				this.inertial_move = params['inertial'];
			if ((typeof params['filtering']) == 'string')
				this.image_filtering = params['filtering'];
		}

		this.cam_heading = this.init_heading;
		this.cam_pitch = this.init_pitch;
		this.cam_fov = this.init_fov;

		this.cam_plane = {
			dir:	makeSFVec(0, 0, 0), 
			up:		makeSFVec(0, 0, 0), 
			right:	makeSFVec(0, 0, 0), 
			origin:	makeSFVec(0, 0, 0)
		};

		var self = this;

		this.inert_fov_step = 0;
		this.inert_heading_step = 0;

		this.idle = true;
		this.last_draw_ms = 0;

		this.button_states = {};
		this.pointer_position = [0, 0];
		this.canvas.addEventListener('mousedown', function(evt) {
			self.button_states[evt.button] = true;
			self.pointer_position[0] = evt.clientX;
			self.pointer_position[1] = evt.clientY;
			evt.preventDefault();
			evt.stopPropagation();
		});
		this.canvas.addEventListener('mouseup', function(evt) {
			self.button_states[evt.button] = false;
			evt.preventDefault();
			evt.stopPropagation();
		});
		this.canvas.addEventListener('mouseout', function(evt) {
			self.button_states[evt.button] = false;
			evt.preventDefault();
			evt.stopPropagation();
		});
		this.canvas.addEventListener('mousemove', function(evt) {
			if (self.is_loaded && !self.is_navigating) {
				if (self.button_states[0]) {
					var deltaHeading = -(evt.clientX - self.pointer_position[0]) * 360 / self.canvas.width;
					if (self.inertial_move == 'on') {
						if ((deltaHeading > 0 && deltaHeading > self.inert_heading_step) || (deltaHeading < 0 && deltaHeading < self.inert_heading_step))
							self.inert_heading_step = deltaHeading;
					}
					else {
						self.cam_heading += deltaHeading;
					}
					self.cam_pitch += (evt.clientY - self.pointer_position[1]) * 180 / self.canvas.height;
					self.cam_pitch = clamp(self.cam_pitch, 0, 180);
					self.pointer_position[0] = evt.clientX;
					self.pointer_position[1] = evt.clientY;
					self.update();
				}
			}
			evt.preventDefault();
			evt.stopPropagation();
		});
		this.canvas.addEventListener(is_firefox ? 'DOMMouseScroll' : 'mousewheel', function(evt) {
			if (self.is_loaded && !self.is_navigating) {
				var newFov = self.cam_fov - (is_firefox ? -40*evt.detail : evt.wheelDelta) / 60;
				newFov = clamp(newFov, 30, 90);
				var deltaFov = newFov - self.cam_fov;
				if (Math.abs(deltaFov) > 0) {
					if (self.inertial_move == 'on') {
						if ((deltaFov > 0 && deltaFov > self.inert_fov_step) || (deltaFov < 0 && deltaFov < self.inert_fov_step))
							self.inert_fov_step = deltaFov;
					}
					else {
						self.cam_fov += deltaFov;
					}
					self.update();
				}
			}
			evt.preventDefault();
			evt.stopPropagation();
		});
		window.addEventListener('resize', function() {
			self._repositionLabelLayer();
			self.update();
		});

		this.saved_canvas_pos = null;

		this.dirty = false;
		this.renderer = null;
		this.is_webgl_enabled = false;
		if (is_webgl_available && !forceSoftwareRendering) {
			try {
				this.renderer = new WebGLRenderer(this);
				this.is_webgl_enabled = true;
			} 
			catch (e) {
			}
		}
		if (!this.renderer) {
			if (forceWebGLRendering)
				throw 'WebGL renderer is not available';
			this.renderer = new Canvas2DRenderer(this);
		}

		this.is_navigating = false;

		this.on_load_handler = null;
		this.on_abort_handler = null;
		this.on_error_handler = null;
		this.on_load_start_handler = null;
		this.on_load_end_handler = null;
		this.on_enter_frame_handler = null;
		this.on_exit_frame_handler = null;

		var inertial_yaw = function() {
			if (self.inert_heading_step != 0) {
				self.cam_heading += self.inert_heading_step;
				self.inert_heading_step *= 0.75;
				if (Math.abs(self.inert_heading_step) < 0.1)
					self.inert_heading_step = 0;
				return true;
			}
			return false;
		};

		var inertial_zoom = function() {
			if (self.inert_fov_step != 0) {
				self.cam_fov += self.inert_fov_step;
				self.inert_fov_step *= 0.7;
				self.inert_fov_step = clamp(self.cam_fov + self.inert_fov_step, 30, 90) - self.cam_fov;
				if (Math.abs(self.inert_fov_step) < 0.1)
					self.inert_fov_step = 0;
				return true;
			}
			return false;
		};

		var tick = function() {
			if (self.is_navigating) {
				// update the tweening engine to perform navigation animations
				TWEEN.update();
			}
			if (self.dirty) {
				// unset idle flag
				self.idle = false;
				// draw a new frame and see if there are further animations
				var has_next_frame = false;
				if (self.inertial_move == 'on') {
					has_next_frame = inertial_yaw();
					has_next_frame = inertial_zoom() || has_next_frame;
				}
				self._draw();
				self._layoutLabels();
				self.dirty = has_next_frame;
				
			}
			else if (!self.idle && (Date.now() - self.last_draw_ms >= 250)) {
				// set idle flag
				self.idle = true;
				// draw a new frame with texture filtering on
				if (!self.is_webgl_enabled && self.image_filtering == 'on-idle')
					self._draw();
			}
			setTimeout(tick, 30);
		};

		// start ticking
		tick();

		// load the given equirectangular image if any
		if (params && (typeof params['equirectangular']) == 'string' && params['equirectangular'] != '')
			this.load(params['equirectangular']);
	}

	View.prototype = {

		get domElement() {
			return this.canvas;
		}, 

		get isMaximized() {
			return this.saved_canvas_pos != null;
		}, 

		get filtering() {
			return this.image_filtering;
		}, 

		set filtering(value) {
			this.image_filtering = value;
		}, 

		get onLoad() {
			return this.on_load_handler;
		}, 

		set onLoad(callback) {
			if (!callback || (typeof callback) == 'function')
				this.on_load_handler = callback;
		}, 

		get OnLoadStart() {
			return this.on_load_start_handler;
		}, 

		set OnLoadStart(callback) {
			if (!callback || (typeof callback) == 'function')
				this.on_load_start_handler = callback;
		}, 

		get OnLoadEnd() {
			return this.on_load_end_handler;
		}, 

		set OnLoadEnd(callback) {
			if (!callback || (typeof callback) == 'function')
				this.on_load_end_handler = callback;
		}, 

		get onAbort() {
			return this.on_abort_handler;
		}, 

		set onAbort(callback) {
			if (!callback || (typeof callback) == 'function')
				this.on_abort_handler = callback;
		}, 

		get onError() {
			return this.on_error_handler;
		}, 

		set onError(callback) {
			if (!callback || (typeof callback) == 'function')
				this.on_error_handler = callback;
		}, 

		get onEnterFrame() {
			return this.on_enter_frame_handler;
		}, 

		set onEnterFrame(callback) {
			if (!callback || (typeof callback) == 'function')
				this.on_enter_frame_handler = callback;
		}, 

		get onExitFrame() {
			return this.on_exit_frame_handler;
		}, 

		set onExitFrame(callback) {
			if (!callback || (typeof callback) == 'function')
				this.on_exit_frame_handler = callback;
		}, 

		load: function(url, reset) {
			// cancel downloading of the previous image if any
			if (this.is_loading) {
				this.img.onload = this.img.onabort = this.img.onerror = null;
				this.img.src = '';
				this.img = null;
				this.is_loading = false;
			}

			var self = this;
			this.img = new Image;
			this.img.onload = function() {
				self.img = null;	// do not cache the image object in view instance
				if (reset || reset == undefined) {
					self.cam_heading = self.init_heading;
					self.cam_pitch = self.init_pitch;
					self.cam_fov = self.init_fov;
				}
				if (self.is_loaded) {
					self._destroyLabels();
					self.flareImgs = {};
					self.lensFlares.length = 0;
					self.renderer.init();
				}
				self.is_loading = false;
				self.is_loaded = true;
				if (self.on_load_handler)
					self.on_load_handler.call(null, self);
				if (self.on_load_end_handler)
					self.on_load_end_handler.call(null, self);
				self.renderer.setImage(this);
				self.update();
			};
			this.img.onabort = function() {
				self.img = null;	// do not cache the image object in view instance
				self.is_loading = false;
				if (self.on_abort_handler)
					self.on_abort_handler.call(null, self);
				if (self.on_load_end_handler)
					self.on_load_end_handler.call(null, self);
			};
			this.img.onerror = function() {
				self.img = null;	// do not cache the image object in view instance
				self.is_loading = false;
				if (self.on_error_handler)
					self.on_error_handler.call(null, self);
				if (self.on_load_end_handler)
					self.on_load_end_handler.call(null, self);
			};

			this.is_loading = true;
			if (this.on_load_start_handler)
				this.on_load_start_handler.call(null, this);
			this.img.src = url;
		}, 

		reset: function() {
			// stop navigation if any and reset the camera
			if (this.is_navigating) {
				TWEEN.removeAll();
				this.is_navigating = false;
			}
			this.cam_heading = this.init_heading;
			this.cam_pitch = this.init_pitch;
			this.cam_fov = this.init_fov;
			this.update();
		}, 

		yaw: function(degs) {
			var newHeading = this.cam_heading + degs;
			if (Math.abs(newHeading - this.cam_heading) > 0) {
				if (this.inertial_move == 'on')
					this.inert_heading_step = newHeading - this.cam_heading;
				else
					this.cam_heading = newHeading;
				this.update();
			}
		}, 

		pitch: function(degs) {
			var newPitch = clamp(this.cam_pitch + degs, 0, 180);
			if (Math.abs(newPitch - this.cam_pitch) > 0) {
				this.cam_pitch = newPitch;
				this.update();
			}
		}, 

		zoom: function(degs) {
			var newFov = clamp(this.cam_fov + degs, 30, 90);
			if (Math.abs(newFov - this.cam_fov) > 0) {
				if (this.inertial_move == 'on')
					this.inert_fov_step = newFov - this.cam_fov;
				else
					this.cam_fov = newFov;
				this.update();
			}
		}, 

		jumpTo: function(heading, pitch, fov) {
			if (heading != undefined)
				this.cam_heading = heading;
			if (pitch != undefined)
				this.cam_pitch = clamp(pitch, 0, 180);
			if (fov != undefined)
				this.cam_fov = clamp(fov, 30, 90);
			this.update();
		}, 

		navigateTo: function(heading, pitch, fov, duration, callbackOnArrival, easingFn) {
			// prevent from starting another navigation when the current one is still active
			if (this.is_navigating)
				return;

			heading = (heading != undefined) ? heading : this.cam_heading;
			pitch = (pitch != undefined) ? clamp(pitch, 0, 180) : this.cam_pitch;
			fov = (fov != undefined) ? clamp(fov, 30, 90) : this.cam_fov;
			duration = (duration != undefined) ? duration : 2000;

			if ((typeof easingFn) == 'string') {
				var matches = /^(\w+)\.(\w+)$/.exec(easingFn);
				easingFn = (matches && TWEEN.Easing[matches[1]]) ? TWEEN.Easing[matches[1]][matches[2]] : undefined;
			}
			easingFn = easingFn || TWEEN.Easing.Quadratic.InOut;

			var self = this;

			var start = {heading: this.cam_heading, pitch: this.cam_pitch, fov: this.cam_fov};
			var end = {heading: heading, pitch: pitch, fov: fov};
			var camInterpolator = new CameraInterpolator(start, end);

			var fraction = {value: 0};
			var tween = (new TWEEN.Tween(fraction)).to({value: 0.999}, duration).easing(easingFn);
			tween.onUpdate(function() {
				var cam = camInterpolator.interpolate(fraction.value);
				self.cam_heading = cam.heading;
				self.cam_pitch = cam.pitch;
				self.cam_fov = cam.fov;
				self.update();
			});
			tween.onComplete(function() {
				self.is_navigating = false;
				if (callbackOnArrival && (typeof callbackOnArrival) == 'function')
					callbackOnArrival.call(null, self);
			});
			tween.start();

			this.is_navigating = true;
		}, 

		playTour: function(path) {
			if (path.length == 0)
				return;
			
			var self = this;
			var navigateToNode = function(index) {
				var node = path[index];
				self.navigateTo( node.heading, node.pitch, node.fov, node.duration, 
								 (index + 1 == path.length) ? // already reaches the end of the tour?
									node.onArrival :
									function() {
										// invoke the callback of the current node, if any
										if (node.onArrival && (typeof node.onArrival) == 'function')
											node.onArrival.call(null, self);
										// then continue to next node
										if (node.hoverTime > 0)
											setTimeout(function() {
												navigateToNode(index + 1);
											}, node.hoverTime);
										else
											navigateToNode(index + 1);
									}
				);
			};
			// start tour
			navigateToNode(0);
		}, 

		addLabel: function(innertHTML, heading, pitch, isInteractive, frameOptions, callbackOnLayout) {
			if (!default_label_style)
				default_label_style = addCSSStyle(label_style_template);

			if (!this.label_layer) {
				if (!label_layer_style)
					label_layer_style = addCSSStyle(label_layer_style_template);

				var canvasRect = this.canvas.getBoundingClientRect();
				this.label_layer = document.createElement('div');
				this.label_layer.className = 'label-layer';
				this.label_layer.style.left = canvasRect.left + 'px';
				this.label_layer.style.top  = canvasRect.top  + 'px';
				this.label_layer.style.width  = canvasRect.width + 'px';
				this.label_layer.style.height = canvasRect.height + 'px';
				document.body.appendChild(this.label_layer);
			}

			var isEnclosedByTag = /^\s*<([a-z][a-z0-9]*)(?:(?:\s+[^<>]*>)|>).*<\/\1>\s*$/.test(innertHTML.replace(/\n/g, ''));

			var container = document.createElement('div');
			container.innerHTML = innertHTML;
			if (!isEnclosedByTag || frameOptions) {
				container.className = 'label-frame';
				if (frameOptions) {
					if (frameOptions.width)
						container.style.width = frameOptions.width;
					if (frameOptions.foregroundColor)
						container.style.color = frameOptions.foregroundColor;
					if (frameOptions.backgroundColor)
						container.style.backgroundColor = frameOptions.backgroundColor;
					if (frameOptions.textAlign)
						container.style.textAlign = frameOptions.textAlign;
					if (frameOptions.borderWidth)
						container.style.borderWidth = frameOptions.borderWidth;
					if (frameOptions.borderColor)
						container.style.borderColor = frameOptions.borderColor;
				}
			}
			else {
				container.style.position = 'absolute';
			}
			if (isInteractive)
				container.style.pointerEvents = 'auto';
			container.style.visibility = 'hidden';
			container.id = 'lb-' + ++new_label_id;
			this.label_layer.appendChild(container);

			this.labels.push({
				element: container, 
				heading: heading, 
				pitch:   pitch, 
				onLayout: (typeof callbackOnLayout) == 'function' ? callbackOnLayout : null
			});
			this.update();

			return container.id;
		}, 

		addLensFlare: function(flareImgURLs, heading, pitch, range, scales) {
			range = range || 1;

			var self = this;
			var flares = [];
			for (var i=0; i<flareImgURLs.length; i++) {
				var url = flareImgURLs[i];
				if (!(url in this.flareImgs)) {
					var img = new Image;
					img.onload = function() {
						var flareObj = self.flareImgs[this.key];
						flareObj.ready = true;
						flareObj.renderId = self.renderer.addSpriteImage(this);
					};
					this.flareImgs[url] = {
						img:   img, 
						ready: false, 
						renderId: -1
					};
					img.key = url;
					img.src = url;
				}
				flares.push({
					obj:  this.flareImgs[url], 
					scale: (scales && scales[i] > 0) ? scales[i] : 1, 
					dist: (i + Math.random()) * range / flareImgURLs.length
				});
			}

			this.lensFlares.push({
				flares:  flares, 
				heading: heading, 
				pitch:   pitch, 
				range:   range || 1
			});
		}, 

		eulerToView: function(heading, pitch) {
			var dir    = this.cam_plane.dir;
			var up     = this.cam_plane.up;
			var right  = this.cam_plane.right;
			var origin = this.cam_plane.origin;

			// create a ray from the given angles
			var rayX = Math.sin(pitch * DEG2RAD) * Math.sin(heading * DEG2RAD);
			var rayY = Math.cos(pitch * DEG2RAD);
			var rayZ = Math.sin(pitch * DEG2RAD) * Math.cos(heading * DEG2RAD);
			// calculate dot product of the ray and the look-at vector of current camera plane
			var t = rayX * dir[0] + rayY * dir[1] + rayZ * dir[2];
			// no intersection?
			if (t <= 0)
				return null;

			t = 1 / t;
			// calculate the vector from the origin of the camera plane to the intersection point
			var dx = t * rayX - origin[0];
			var dy = t * rayY - origin[1];
			var dz = t * rayZ - origin[2];

			var ratioUp = 2 * Math.tan(0.5 * this.cam_fov * DEG2RAD);
			var ratioRight = this.canvas.width * ratioUp / this.canvas.height;

			// project the vector onto the up and the right vectors of the camera plane to calculate
			// fractions on both directions
			var fractUp    = -(dx * up[0] + dy * up[1] + dz * up[2]) / (ratioUp * ratioUp);
			var fractRight =  (dx * right[0] + dy * right[1] + dz * right[2]) / (ratioRight * ratioRight);

			return [Math.floor(0.5 + fractRight * this.canvas.width), Math.floor(0.5 + fractUp * this.canvas.height)];
		}, 

		viewToEuler: function(x, y) {
			var dir    = this.cam_plane.dir;
			var up     = this.cam_plane.up;
			var right  = this.cam_plane.right;
			var origin = this.cam_plane.origin;

			var fractUp = y / this.canvas.height;
			var fractRight = x / this.canvas.width;

			// create a ray from the given coordinate
			var rayX = origin[0] + right[0] * fractRight - up[0] * fractUp;
			var rayY = origin[1] + right[1] * fractRight - up[1] * fractUp;
			var rayZ = origin[2] + right[2] * fractRight - up[2] * fractUp;

			// calculate angles from the ray
			var heading = 0.5 * Math.PI - Math.atan2(rayZ, rayX);
			var pitch   = Math.acos(rayY / Math.sqrt(rayX*rayX + rayY*rayY + rayZ*rayZ));

			return [RAD2DEG * heading, RAD2DEG * pitch];
		}, 

		maximize: function() {
			if (!this.saved_canvas_pos) {
				// save current size and position of the canvas
				this.saved_canvas_pos = {
					zIndex:			this.canvas.style.zIndex, 
					position:		this.canvas.style.position, 
					left:			this.canvas.style.left, 
					top:			this.canvas.style.top, 
					innerWidth:		this.canvas.style.width, 
					innerHeight:	this.canvas.style.height, 
					logicalWidth:	this.canvas.width, 
					logicalHeight:	this.canvas.height
				};

				// set canvas to the topmost layer and resize it to fill the whole client area of the page
				this.canvas.style.zIndex	= '1024';
				this.canvas.style.position	= 'fixed';
				this.canvas.style.left		= '0px';
				this.canvas.style.top		= '0px';
				this.canvas.style.width		= '100%';
				this.canvas.style.height	= '100%';

				// also reposition the label layer
				if (this.label_layer) {
					this._repositionLabelLayer();
					this.label_layer.style.zIndex = '1025';
					this.label_layer.style.position = 'fixed';
				}

				// redraw with the new size
				this.update();
			}
		}, 

		restore: function() {
			if (this.saved_canvas_pos) {
				// restore canvas size and position
				this.canvas.style.zIndex	= this.saved_canvas_pos.zIndex;
				this.canvas.style.position	= this.saved_canvas_pos.position;
				this.canvas.style.left		= this.saved_canvas_pos.left;
				this.canvas.style.top		= this.saved_canvas_pos.top;
				this.canvas.style.width		= this.saved_canvas_pos.innerWidth;
				this.canvas.style.height	= this.saved_canvas_pos.innerHeight;
				this.canvas.width			= this.saved_canvas_pos.logicalWidth;
				this.canvas.height			= this.saved_canvas_pos.logicalHeight;

				// remove the saved canvas state
				this.saved_canvas_pos = null;

				// restore size and position of the label layer
				if (this.label_layer) {
					this._repositionLabelLayer();
					this.label_layer.style.zIndex = '';
					this.label_layer.style.position = 'absolute';
				}

				// redraw with the new size
				this.update();
			}
		}, 

		saveScreenshot: function(basename, format, quality) {
			basename = basename || 'screenshot';
			format = (format == 'jpg' ? 'jpeg' : format) || 'jpeg';
			quality = quality || 0.8;

			if (screenshot_method == 'unknown') {
				screenshot_helper = document.createElement('a');
				if ((typeof screenshot_helper.download) == 'string') {
					screenshot_method = 'local';
					screenshot_helper.id = 'screenshot-helper';
					screenshot_helper.href = 'javscript:void(0)';
				}
				else {
					screenshot_method = 'remote';
					screenshot_helper = document.createElement('iframe');
					screenshot_helper.id = 'screenshot-helper';
					screenshot_helper.name = 'screenshot-helper';
				}
				screenshot_helper.style.display = 'none';
				document.body.appendChild(screenshot_helper);
			}

			var fireDownload;
			if (screenshot_method == 'local') {
				/*
				 * Set anchor's 'download' attribute with a correct file name. This specifies a new navigation 
				 * behaviour that when the link is clicked, it prompts the user to save the given data URL as a
				 * local image file.
				 * See http://caniuse.com/#feat=download and https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a 
				 * for support of the 'download' attribute on different browsers. 
				 */
				fireDownload = function(unused, dataURL) {
					var matches = /^data:image\/([a-zA-Z0-9]+);base64,/.exec(dataURL);
					var extension = matches[1] == 'jpeg' ? 'jpg' : matches[1];

					screenshot_helper.download = basename + '.' + extension;
					screenshot_helper.onclick = function() {
						this.href = dataURL;
					};

					// fire a click event to the anchor to launch the download
					screenshot_helper.click();
				};
			}
			else {
				/*
				 * Send the data URL to server side, where it will be decoded and packed to an image file 
				 * with correct file extension and then a download will be launched.
				 */
				fireDownload = function(unused, dataURL) {
					var targetURL = getScriptPath('pano.js', true);
					if (targetURL) {
						var form = document.createElement('form');
						form.action = targetURL + 'save_screenshot.php';
						form.method = 'post';
						form.target = 'screenshot-helper';
						form.style.display = 'none';

						var input = document.createElement('input');
						input.type  = 'hidden';
						input.name  = 'dataurl';
						input.value = dataURL;

						var input2 = document.createElement('input');
						input2.type  = 'hidden';
						input2.name  = 'basename';
						input2.value = basename;

						form.appendChild(input);
						form.appendChild(input2);
						document.body.appendChild(form);

						form.submit();
						document.body.removeChild(form);
					}
				};
			}

			// Read instant state of the canvas as data URL in asynchronous mode, and then launch download using
			// the given method as soon as the data is ready.
			this.renderer.readPixelsAsDataURL('image/' + format, quality, fireDownload);

			// for WebGL renderer, an extra frame is required to generate and pass back the data URL immediately
			if (this.is_webgl_enabled) {
				this.update();
			}
		}, 

		update: function() {
			this.dirty = true;
		}, 

		_draw: function() {
			// Adjust canvas's logical size to be the same as its inner size in pixels. 
			// This is necessary for canvas may have been resized.
			if (this.canvas.width != this.canvas.clientWidth)
				this.canvas.width = this.canvas.clientWidth;
			if (this.canvas.height != this.canvas.clientHeight)
				this.canvas.height = this.canvas.clientHeight;

			if (this.on_enter_frame_handler)
				this.on_enter_frame_handler.call(null, this, this.canvas.width, this.canvas.height);

			this.renderer.beginFrame();
			this._drawPanorama();
			this._drawLensFlares();
			this.renderer.endFrame();

			// update timestamp
			this.last_draw_ms = Date.now();

			if (this.on_exit_frame_handler)
				this.on_exit_frame_handler.call(null, this, this.canvas.width, this.canvas.height);
		}, 

		_drawPanorama: function() {
			/*
			 * Calculate current camera plane.
			 */
			var heading = this.cam_heading;
			var pitch = this.cam_pitch;
			var fov = this.cam_fov;
			var camPlane = this.cam_plane;
			var ratioUp = 2 * Math.tan(0.5 * fov * DEG2RAD);
			var ratioRight = this.canvas.width * ratioUp / this.canvas.height;
			camPlane.dir[0]    = Math.sin(pitch * DEG2RAD) * Math.sin(heading * DEG2RAD);
			camPlane.dir[1]    = Math.cos(pitch * DEG2RAD);
			camPlane.dir[2]    = Math.sin(pitch * DEG2RAD) * Math.cos(heading * DEG2RAD);
			camPlane.up[0]     = ratioUp * Math.sin((pitch - 90) * DEG2RAD) * Math.sin(heading * DEG2RAD);
			camPlane.up[1]     = ratioUp * Math.cos((pitch - 90) * DEG2RAD);
			camPlane.up[2]     = ratioUp * Math.sin((pitch - 90) * DEG2RAD) * Math.cos(heading * DEG2RAD);
			camPlane.right[0]  = ratioRight * Math.sin((heading - 90) * DEG2RAD);
			camPlane.right[1]  = 0;
			camPlane.right[2]  = ratioRight * Math.cos((heading - 90) * DEG2RAD);
			camPlane.origin[0] = camPlane.dir[0] + 0.5 * camPlane.up[0] - 0.5 * camPlane.right[0];
			camPlane.origin[1] = camPlane.dir[1] + 0.5 * camPlane.up[1] - 0.5 * camPlane.right[1];
			camPlane.origin[2] = camPlane.dir[2] + 0.5 * camPlane.up[2] - 0.5 * camPlane.right[2];

			// render panorama with current camera plane
			this.renderer.renderEquirectangular(camPlane.origin, camPlane.up, camPlane.right);
		}, 

		_drawLensFlares: function() {
			if (this.lensFlares.length == 0)
				return;

			var centerX = this.canvas.width >> 1;
			var centerY = this.canvas.height >> 1;
			var halfLenOfDiagonal = Math.sqrt(centerX * centerX + centerY * centerY);

			this.renderer.beginSprite();
			for (var i=0; i<this.lensFlares.length; i++) {
				var lensFlare = this.lensFlares[i];
				// calculate position of the corresponding light source on canvas
				var lightPos = this.eulerToView(lensFlare.heading, lensFlare.pitch);
				if (!lightPos)
					continue;
				if (lightPos[0] < 0 || lightPos[0] >= this.canvas.width || 
					lightPos[1] < 0 || lightPos[1] >= this.canvas.height)
					continue;

				// calculate the vector from the light source to center of the canvas
				var dirX = centerX - lightPos[0];
				var dirY = centerY - lightPos[1];
				var l = Math.sqrt(dirX * dirX + dirY * dirY);
				// render the group of flares
				var flares = lensFlare.flares;
				for (var j=0; j<flares.length; j++) {
					var flare = flares[j];
					if (flare.obj.ready) {
						// the center position of this flare on canvas
						var x = lightPos[0] + 2 * lensFlare.range * flare.dist * dirX;
						var y = lightPos[1] + 2 * lensFlare.range * flare.dist * dirY;
						var alpha = 1 - l / halfLenOfDiagonal;
						this.renderer.renderSprite(flare.obj.renderId, x, y, alpha, flare.scale, 'additive');
					}
				}
			}
			this.renderer.endSprite();
		}, 

		_layoutLabels: function() {
			var canvasRect = this.canvas.getBoundingClientRect();
			for (var i=0; i<this.labels.length; i++) {
				var label = this.labels[i];
				var coordOnCanvas = this.eulerToView(label.heading, label.pitch);
				if (!coordOnCanvas)
					label.element.style.visibility = 'hidden';
				else {
					if (label.onLayout)
						label.onLayout.call(null, this, label.element, coordOnCanvas[0], coordOnCanvas[1]);
					else {
						label.element.style.left = coordOnCanvas[0] + 'px';
						label.element.style.top  = coordOnCanvas[1] + 'px';
					}
					var labelRect = label.element.getBoundingClientRect();
					var clipRect = intersectRects(labelRect, canvasRect);
					if (clipRect.width > 0 && clipRect.height > 0)
						label.element.style.visibility = 'visible';
					else
						label.element.style.visibility = 'hidden';
				}
			}
		}, 

		_repositionLabelLayer: function() {
			if (this.label_layer) {
				var layerRect  = this.label_layer.getBoundingClientRect();
				var canvasRect = this.canvas.getBoundingClientRect();
				if ( layerRect.left != canvasRect.left || layerRect.top != canvasRect.top || 
					 layerRect.width != canvasRect.width || layerRect.height != canvasRect.height ) {
					this.label_layer.style.left = window.pageXOffset + canvasRect.left + 'px';
					this.label_layer.style.top  = window.pageYOffset + canvasRect.top  + 'px';
					this.label_layer.style.width  = canvasRect.width  + 'px';
					this.label_layer.style.height = canvasRect.height + 'px';
				}
			}
		}, 

		_destroyLabels: function() {
			for (var i=this.labels.length-1; i>=0; i--) {
				this.label_layer.removeChild(this.labels[i].element);
			}
			this.labels.length = 0;
		}

	};

	
	/**
		@class Canvas2DRenderer
	 */
	function Canvas2DRenderer(view) {
		this.view = view;
		this.canvas = view.canvas;
		this.ctx2d = view.canvas.getContext('2d');
		this.canvas_width = view.canvas.width;
		this.canvas_height = view.canvas.height;
		this.canvas_data = null;
		this.img_width = 0;
		this.img_height = 0;
		this.img_pixels = null;
		this.sprite_imgs = [];
		this.cached_sprites = [];
	}

	Canvas2DRenderer.prototype = {

		init: function() {
			this.img_width = 0;
			this.img_height = 0;
			this.img_pixels = null;
			this.sprite_imgs.length = 0;
			this.cached_sprites.length = 0;
		}, 

		setImage: function(img) {
			var w = img.width;
			var h = img.height;
			var cv = getUtilCanvas(w, h);

			var ctx = cv.getContext('2d');
			ctx.drawImage(img, 0, 0, w, h);
			var imgData = ctx.getImageData(0, 0, w, h);
			cv.width = 0;
			cv.height = 0;

			this.img_pixels = imgData.data;
			this.img_width = w;
			this.img_height = h;
		}, 

		addSpriteImage: function(img) {
			// if the given object is a canvas, use its contents to create a real image
			if (img instanceof window.HTMLCanvasElement)
				img = generateImageFromCanvas(img);

			this.sprite_imgs.push(img);
			return this.sprite_imgs.length;
		}, 

		beginFrame: function() {
			// data buffer should be reallocated if canvas size has changed
			if (this.canvas_width != this.canvas.width || this.canvas_height != this.canvas.height) {
				this.canvas_width = this.canvas.width;
				this.canvas_height = this.canvas.height;
				this.canvas_data = null;
			}
			if (!this.canvas_data)
				this.canvas_data = this.ctx2d.createImageData(this.canvas_width, this.canvas_height);
		}, 

		endFrame: function() {
			this.ctx2d.putImageData(this.canvas_data, 0, 0);

			// draw all cached sprites
			this.ctx2d.save();
			for (var i=0; i<this.cached_sprites.length; i++) {
				var sprite = this.cached_sprites[i];
				if (this.ctx2d.globalCompositeOperation != sprite.compositor)
					this.ctx2d.globalCompositeOperation = sprite.compositor; // apply the given pixel blending mode
				this.ctx2d.globalAlpha = sprite.alpha;
				this.ctx2d.drawImage(sprite.img, sprite.left, sprite.top, sprite.width, sprite.height);
			}
			// clear the sprite cache
			this.cached_sprites.length = 0;
			this.ctx2d.restore();
		}, 

		renderEquirectangular: function(origin, up, right) {
			if (!this.canvas_data || !this.img_pixels)
				return;

			var srcWidth = this.img_width;
			var srcHeight = this.img_height;
			var destWidth = this.canvas.width;
			var destHeight = this.canvas.height;

			var data = this.canvas_data.data;

			var useBilinear = this.view.image_filtering == 'on' || (this.view.idle && this.view.image_filtering == 'on-idle');

			/*
			 *	The idea is quite straightforward: calculate a ray for each pixel on canvas based upon the camera plane. Then  
			 *	calculate corresponding texture coordinates from the spherical coodinates (phi, theta) to get correct texels. 
			 *	For efficiency, we only execute the calculation for each slice of 8 pixels and then linearly interpolate texels inside slices.
			 */

			var thetaFactor = (srcHeight - 1) / Math.PI;
			var phiFactor = 0.5 * srcWidth / Math.PI;

			var srcHalfWidth = srcWidth >> 1;

			var pixels = this.img_pixels;
			var numOf8Pixels = ~~(destWidth / 8);
			var surplus = destWidth % 8;
			for (var i=0; i<destHeight; i++) {
				var y = i / destHeight;

				// the ray for the first pixel of the scanline
				var rayX = origin[0] - up[0] * y;
				var rayY = origin[1] - up[1] * y;
				var rayZ = origin[2] - up[2] * y;
				var rayLen = Math.sqrt(rayX * rayX + rayY * rayY + rayZ * rayZ);
				
				// tex coords for the first pixel of the scanline
				var theta0 = thetaFactor * Math.acos(rayY / rayLen);
				var phi0 = phiFactor * (Math.atan2(rayZ, rayX) + Math.PI);

				var isDone = false;
				var n = numOf8Pixels;

				var dest = 4 * i * destWidth;

				var k = 0;
				do {
					var rl;
					if (n-- > 0) {
						rl = 8;
						k += 8;
					}
					else if (surplus > 0) {
						rl = surplus;
						k += surplus;
						isDone = true;
					}
					else
						break;

					var x = k / destWidth;

					// the ray for the end pixel of current slice
					rayX = origin[0] + right[0] * x - up[0] * y;
					rayY = origin[1] + right[1] * x - up[1] * y;
					rayZ = origin[2] + right[2] * x - up[2] * y;
					rayLen = Math.sqrt(rayX * rayX + rayY * rayY + rayZ * rayZ);
					
					// tex coords for the end pixel of current slice
					var theta1 = thetaFactor * Math.acos(rayY / rayLen);
					var phi1 = phiFactor * (Math.atan2(rayZ, rayX) + Math.PI);

					// tex coord increments
					var deltaTheta = theta1 - theta0;
					var deltaPhi = phi1 - phi0;
					var thetaInc256 = ~~(256 * deltaTheta / rl);
					var phiInc256;
					if (deltaPhi < -srcHalfWidth)		// the slice passes through the right image boundary
						phiInc256 = ~~(256 * (srcWidth + deltaPhi) / rl);
					else if (deltaPhi > srcHalfWidth)	// the slice passes through the left image boundary
						phiInc256 = ~~(256 * (-srcWidth + deltaPhi) / rl);
					else
						phiInc256 = ~~(256 * deltaPhi / rl);

					/*
					 *	Linearly interpolate texels for each pixel inside the slice.
					 */
					if (!useBilinear) {
						for (var j=0, theta256=~~(256*theta0), phi256=~~(256*phi0); j<rl; j++, theta256+=thetaInc256, phi256+=phiInc256) {
							var src = 4 * ((theta256 >> 8) * srcWidth + ((phi256 >> 8) + srcWidth) % srcWidth);
							data[dest    ] = pixels[src    ];
							data[dest + 1] = pixels[src + 1];
							data[dest + 2] = pixels[src + 2];
							data[dest + 3] = 0xff;
							dest += 4;
						}
					}
					else {
						/*
						 *	Apply bilinear filtering.
						 */
						//TODO: this still need to be optimized.
						for (var j=0, theta256=~~(256*theta0), phi256=~~(256*phi0); j<rl; j++, theta256+=thetaInc256, phi256+=phiInc256) {
							var t0 = theta256 >> 8;
							var p0 = ((phi256 >> 8) + srcWidth) % srcWidth;
							var t1 = t0 + 1;
							var p1 = p0 + 1;
							if (t1 >= srcHeight)
								t1 = t0;
							if (p1 >= srcWidth)
								p1 = p0;
							var a = theta256 & 255;
							var b = 256 - a;
							var c = phi256 & 255;
							var d = 256 - c;
							var f00 = b * d;
							var f01 = b * c;
							var f10 = a * d;
							var f11 = a * c;
							var src00 = 4 * (t0 * srcWidth + p0);
							var src01 = 4 * (t0 * srcWidth + p1);
							var src10 = 4 * (t1 * srcWidth + p0);
							var src11 = 4 * (t1 * srcWidth + p1);

							data[dest    ] = (f00 * pixels[src00    ] + f01 * pixels[src01    ] + f10 * pixels[src10    ] + f11 * pixels[src11    ]) >> 16;
							data[dest + 1] = (f00 * pixels[src00 + 1] + f01 * pixels[src01 + 1] + f10 * pixels[src10 + 1] + f11 * pixels[src11 + 1]) >> 16;
							data[dest + 2] = (f00 * pixels[src00 + 2] + f01 * pixels[src01 + 2] + f10 * pixels[src10 + 2] + f11 * pixels[src11 + 2]) >> 16;
							data[dest + 3] = 0xff;
							dest += 4;
						}
					}

					// continue to next slice, if any
					theta0 = theta1;
					phi0 = phi1;
				} while (!isDone);
			}
		}, 

		beginSprite: function() {
		}, 

		endSprite: function() {
		}, 

		renderSprite: function(renderId, x, y, alpha, scale, blending) {
			if (!this.canvas_data || renderId < 1 || renderId > this.sprite_imgs.length)
				return;

			var img = this.sprite_imgs[renderId - 1];
			var w = img.width;
			var h = img.height;

			scale = scale || 1;
			w *= scale;
			h *= scale;

			// drawing of sprites will be defered until the end of each frame
			this.cached_sprites.push({
				img: img, 
				left: Math.floor(0.5 + x - 0.5 * w), 
				top:  Math.floor(0.5 + y - 0.5 * h), 
				width:	Math.floor(w), 
				height: Math.floor(h), 
				alpha: (alpha != undefined) ? alpha : 1, 
				compositor: (blending == 'additive') ? 'lighter' : 'source-over'
			});
		}, 

		readPixelsAsDataURL: function(type, quality, callbackOnReady) {
			try {
				var dataURL = getDataURLFromCanvas(this.canvas, type, quality);
				/*
				 * If callbackOnReady is set, it will be used to passing back the data URL in 
				 * an asynchronous manner. Otherwise the data URL will be returned immediately.
				 */
				if (callbackOnReady && (typeof callbackOnReady) == 'function') {
					var self = this;
					setTimeout(function() {
						callbackOnReady.call(null, self, dataURL);
					}, 1);
				}
				else
					return dataURL;
			}
			catch (e) {
			}

			return undefined;
		}

	};


	/**
	 *	@class WebGLRenderer
	 */
	function WebGLRenderer(view) {
		this.view = view;
		this.canvas = view.canvas;
		this.gl = getWebGL(view.canvas);
		if (!this.gl)
			throw 'Cannot get WebGL context';
		this.equirectangular_program = null;
		this.sprite_program = null;
		this.canvas_quad = null;
		this.img_texture = null;
		this.img_width = 0;
		this.img_height = 0;
		this.sprite_objs = [];
		this.dataurl_requester = null;
	}

	WebGLRenderer.prototype = {

		init: function() {
			this.img_width = 0;
			this.img_height = 0;
			this.img_texture = null;
			this.sprite_objs.length = 0;
		}, 

		setImage: function(img) {
			var isPOT = isPowerOfTwo(img.width) && isPowerOfTwo(img.height);
			var gl = this.gl;

			// create hardware texture with the given filter
			var mapFilter = (this.view.image_filtering == 'off') ? gl.NEAREST : gl.LINEAR;
			this.img_texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.img_texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, mapFilter);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mapFilter);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.bindTexture(gl.TEXTURE_2D, null);

			this.img_width = img.width;
			this.img_height = img.height;
		}, 

		addSpriteImage: function(img) {
			var gl = this.gl;

			var spriteObj = {};

			spriteObj.texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, spriteObj.texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.bindTexture(gl.TEXTURE_2D, null);

			spriteObj.coords = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, spriteObj.coords);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);

			spriteObj.size = [img.width, img.height];
			spriteObj.u_size = new Float32Array([1, 1]);
			spriteObj.u_anchor = new Float32Array([0, 0]);

			this.sprite_objs.push(spriteObj);
			return this.sprite_objs.length;
		}, 

		beginFrame: function() {
			var gl = this.gl;
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.viewport(0, 0, this.canvas.width, this.canvas.height);
		}, 

		endFrame: function() {
			this.gl.flush();

			// get data URL from canvas and pass it to its requester using the registered callback function
			if (this.dataurl_requester) {
				try {
					var daraURL = getDataURLFromCanvas(this.canvas, this.dataurl_requester.type, this.dataurl_requester.quality);
					this.dataurl_requester.callback.call(null, this, daraURL);
				}
				catch (e) {
				}
				this.dataurl_requester = null;
			}
		}, 

		renderEquirectangular: function(origin, up, right) {
			if (!this.gl || !this.img_texture)
				return;

			var gl = this.gl;

			if (!this.equirectangular_program)
				this.equirectangular_program = createProgram(gl, equirectangular_vs, equirectangular_fs);

			if (!this.canvas_quad) {
				this.canvas_quad = {};
				this.canvas_quad.coords = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, this.canvas_quad.coords);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
				gl.bindBuffer(gl.ARRAY_BUFFER, null);
			}


			gl.disable(gl.BLEND);
			gl.disable(gl.DEPTH_TEST);
			gl.depthMask(false);

			gl.useProgram(this.equirectangular_program);

			// update uniforms
			gl.uniform3fv(gl.getUniformLocation(this.equirectangular_program, 'u_camUp'), up);
			gl.uniform3fv(gl.getUniformLocation(this.equirectangular_program, 'u_camRight'), right);
			gl.uniform3fv(gl.getUniformLocation(this.equirectangular_program, 'u_camPlaneOrigin'), origin);

			// set sampler
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.img_texture);
			gl.uniform1i(gl.getUniformLocation(this.equirectangular_program, 's_texture'), 0);

			// render to canvas
			gl.enableVertexAttribArray(0);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.canvas_quad.coords);
			gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
			gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			gl.bindTexture(gl.TEXTURE_2D, null);
		}, 

		beginSprite: function() {
			if (!this.gl)
				return;

			var gl = this.gl;

			if (!this.sprite_program)
				this.sprite_program = createProgram(gl, sprite_vs, sprite_fs);
			gl.useProgram(this.sprite_program);

			gl.enable(gl.BLEND);
			gl.blendEquation(gl.FUNC_ADD);
		}, 

		endSprite: function() {
			if (!this.gl)
				return;

			var gl = this.gl;
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			gl.bindTexture(gl.TEXTURE_2D, null);
		}, 

		renderSprite: function(renderId, x, y, alpha, scale, blending) {
			if (!this.gl || renderId < 1 || renderId > this.sprite_objs.length)
				return;

			alpha = (alpha != undefined) ? alpha : 1;
			scale = scale || 1;

			var w = this.canvas.width;
			var h = this.canvas.height;
			var spriteObj = this.sprite_objs[renderId - 1];
			spriteObj.u_size[0] = scale * spriteObj.size[0] / w;
			spriteObj.u_size[1] = scale * spriteObj.size[1] / h;
			spriteObj.u_anchor[0] = 2 * x / w - 1;
			spriteObj.u_anchor[1] = 2 * (1 - y / h) - 1;

			var gl = this.gl;

			if (blending == 'additive')
				gl.blendFunc(gl.ONE, gl.ONE);
			else
				gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);

			gl.uniform2fv(gl.getUniformLocation(this.sprite_program, 'u_anchor'), spriteObj.u_anchor);
			gl.uniform2fv(gl.getUniformLocation(this.sprite_program, 'u_size'), spriteObj.u_size);
			gl.uniform1f(gl.getUniformLocation(this.sprite_program, 'u_alpha'), alpha);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, spriteObj.texture);
			gl.uniform1i(gl.getUniformLocation(this.sprite_program, 's_texture'), 0);

			gl.enableVertexAttribArray(0);
			gl.bindBuffer(gl.ARRAY_BUFFER, spriteObj.coords);
			gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
			gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			gl.bindTexture(gl.TEXTURE_2D, null);
		}, 

		readPixelsAsDataURL: function(type, quality, callbackOnReady) {
			/*
			 * If callbackOnReady is set a function, the data URL will be generated and passed back asynchronously
			 * when next frame is done. This ensures a non-blank result that holds the instant state of the canvas.
			 * Otherwise the data URL will be generated and returned immediately. In this case, the result may be an
			 * image with expected contents or just a blank one, depending on the implementation of different browsers.
			 */
			if (callbackOnReady && (typeof callbackOnReady) == 'function') {
				this.dataurl_requester = {
					type:     type, 
					quality:  quality, 
					callback: callbackOnReady
				};
			}
			else {
				try {
					return getDataURLFromCanvas(this.canvas, type, quality);
				}
				catch (e) {
				}
			}

			return undefined;
		}

	};


	/**
	 *	@class CameraInterpolator
	 */
	function CameraInterpolator(start, end) {
		this.q0 = eulerToQuat(start.heading, start.pitch);
		this.fov0 = start.fov;
		this.q1 = eulerToQuat(end.heading, end.pitch);
		this.fov1 = end.fov;
	}

	CameraInterpolator.prototype = {

		interpolate: function(fraction) {
			var x0 = this.q0[0], y0 = this.q0[1], z0 = this.q0[2], w0 = this.q0[3];
			var x1 = this.q1[0], y1 = this.q1[1], z1 = this.q1[2], w1 = this.q1[3];

			/*
			 *	Slerp between the start and the end quaternions using the given fraction value.
			 */

			var cosOmega = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1;
			if (cosOmega < 0) {
				x1 = -x1;
				y1 = -y1;
				z1 = -z1;
				w1 = -w1;
				cosOmega = -cosOmega;
			}

			var k0, k1;
			if (cosOmega < 1) {
				var omega = Math.acos(cosOmega);
				var sinOmega = Math.sin(omega);
				k0 = Math.sin((1 - fraction) * omega) / sinOmega;
				k1 = Math.sin(fraction * omega) / sinOmega;
			}
			else {
				k0 = 1 - fraction;
				k1 = fraction;
			}

			// convert the result back to euler angles
			var angles = quatToEuler(k0*x0 + k1*x1, k0*y0 + k1*y1, k0*z0 + k1*z1, k0*w0 + k1*w1);

			// calculate field of view using linear interpolation
			var fov = (1 - fraction) * this.fov0 + fraction * this.fov1;

			return {heading: angles[0], pitch: angles[1], fov: fov};
		}

	};


	Pano.View = View;

}) ();



/**
 * @preserve Tween.js
 *
 * @author sole / http://soledadpenades.com
 * @author mrdoob / http://mrdoob.com
 * @author Robert Eisele / http://www.xarg.org
 * @author Philippe / http://philippe.elsass.me
 * @author Robert Penner / http://www.robertpenner.com/easing_terms_of_use.html
 * @author Paul Lewis / http://www.aerotwist.com/
 * @author lechecacharro
 * @author Josh Faul / http://jocafa.com/
 * @author egraether / http://egraether.com/
 * @author endel / http://endel.me
 *
 * Tween.js is published under the MIT license.
 */

var TWEEN = TWEEN || ( function () {

	var _tweens = [];

	return {

		REVISION: '10',

		getAll: function () {

			return _tweens;

		},

		removeAll: function () {

			_tweens = [];

		},

		add: function ( tween ) {

			_tweens.push( tween );

		},

		remove: function ( tween ) {

			var i = _tweens.indexOf( tween );

			if ( i !== -1 ) {

				_tweens.splice( i, 1 );

			}

		},

		update: function ( time ) {

			if ( _tweens.length === 0 ) return false;

			var i = 0, numTweens = _tweens.length;

			time = time !== undefined ? time : ( window.performance !== undefined && window.performance.now !== undefined ? window.performance.now() : Date.now() );

			while ( i < numTweens ) {

				if ( _tweens[ i ].update( time ) ) {

					i ++;

				} else {

					_tweens.splice( i, 1 );

					numTweens --;

				}

			}

			return true;

		}
	};

} )();

TWEEN.Tween = function ( object ) {

	var _object = object;
	var _valuesStart = {};
	var _valuesEnd = {};
	var _valuesStartRepeat = {};
	var _duration = 1000;
	var _repeat = 0;
	var _delayTime = 0;
	var _startTime = null;
	var _easingFunction = TWEEN.Easing.Linear.None;
	var _interpolationFunction = TWEEN.Interpolation.Linear;
	var _chainedTweens = [];
	var _onStartCallback = null;
	var _onStartCallbackFired = false;
	var _onUpdateCallback = null;
	var _onCompleteCallback = null;

	// Set all starting values present on the target object
	for ( var field in object ) {

		_valuesStart[ field ] = parseFloat(object[field], 10);

	}

	this.to = function ( properties, duration ) {

		if ( duration !== undefined ) {

			_duration = duration;

		}

		_valuesEnd = properties;

		return this;

	};

	this.start = function ( time ) {

		TWEEN.add( this );

		_onStartCallbackFired = false;

		_startTime = time !== undefined ? time : (window.performance !== undefined && window.performance.now !== undefined ? window.performance.now() : Date.now() );
		_startTime += _delayTime;

		for ( var property in _valuesEnd ) {

			// check if an Array was provided as property value
			if ( _valuesEnd[ property ] instanceof Array ) {

				if ( _valuesEnd[ property ].length === 0 ) {

					continue;

				}

				// create a local copy of the Array with the start value at the front
				_valuesEnd[ property ] = [ _object[ property ] ].concat( _valuesEnd[ property ] );

			}

			_valuesStart[ property ] = _object[ property ];

			if( ( _valuesStart[ property ] instanceof Array ) === false ) {
				_valuesStart[ property ] *= 1.0; // Ensures we're using numbers, not strings
			}

			_valuesStartRepeat[ property ] = _valuesStart[ property ] || 0;

		}

		return this;

	};

	this.stop = function () {

		TWEEN.remove( this );
		return this;

	};

	this.delay = function ( amount ) {

		_delayTime = amount;
		return this;

	};

	this.repeat = function ( times ) {

		_repeat = times;
		return this;

	};

	this.easing = function ( easing ) {

		_easingFunction = easing;
		return this;

	};

	this.interpolation = function ( interpolation ) {

		_interpolationFunction = interpolation;
		return this;

	};

	this.chain = function () {

		_chainedTweens = arguments;
		return this;

	};

	this.onStart = function ( callback ) {

		_onStartCallback = callback;
		return this;

	};

	this.onUpdate = function ( callback ) {

		_onUpdateCallback = callback;
		return this;

	};

	this.onComplete = function ( callback ) {

		_onCompleteCallback = callback;
		return this;

	};

	this.update = function ( time ) {

		if ( time < _startTime ) {

			return true;

		}

		if ( _onStartCallbackFired === false ) {

			if ( _onStartCallback !== null ) {

				_onStartCallback.call( _object );

			}

			_onStartCallbackFired = true;

		}

		var elapsed = ( time - _startTime ) / _duration;
		elapsed = elapsed > 1 ? 1 : elapsed;

		var value = _easingFunction( elapsed );

		for ( var property in _valuesEnd ) {

			var start = _valuesStart[ property ] || 0;
			var end = _valuesEnd[ property ];

			if ( end instanceof Array ) {

				_object[ property ] = _interpolationFunction( end, value );

			} else {

				if ( typeof(end) === "string" ) {
					end = start + parseFloat(end, 10);
				}

				_object[ property ] = start + ( end - start ) * value;

			}

		}

		if ( _onUpdateCallback !== null ) {

			_onUpdateCallback.call( _object, value );

		}

		if ( elapsed == 1 ) {

			if ( _repeat > 0 ) {

				if( isFinite( _repeat ) ) {
					_repeat--;
				}

				// reassign starting values, restart by making startTime = now
				for( var property in _valuesStartRepeat ) {

					if ( typeof( _valuesEnd[ property ] ) === "string" ) {
						_valuesStartRepeat[ property ] = _valuesStartRepeat[ property ] + parseFloat(_valuesEnd[ property ], 10);
					}

					_valuesStart[ property ] = _valuesStartRepeat[ property ];

				}

				_startTime = time + _delayTime;

				return true;

			} else {

				if ( _onCompleteCallback !== null ) {

					_onCompleteCallback.call( _object );

				}

				for ( var i = 0, numChainedTweens = _chainedTweens.length; i < numChainedTweens; i ++ ) {

					_chainedTweens[ i ].start( time );

				}

				return false;

			}

		}

		return true;

	};

};

TWEEN.Easing = {

	Linear: {

		None: function ( k ) {

			return k;

		}

	},

	Quadratic: {

		In: function ( k ) {

			return k * k;

		},

		Out: function ( k ) {

			return k * ( 2 - k );

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k;
			return - 0.5 * ( --k * ( k - 2 ) - 1 );

		}

	},

	Cubic: {

		In: function ( k ) {

			return k * k * k;

		},

		Out: function ( k ) {

			return --k * k * k + 1;

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k;
			return 0.5 * ( ( k -= 2 ) * k * k + 2 );

		}

	},

	Quartic: {

		In: function ( k ) {

			return k * k * k * k;

		},

		Out: function ( k ) {

			return 1 - ( --k * k * k * k );

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1) return 0.5 * k * k * k * k;
			return - 0.5 * ( ( k -= 2 ) * k * k * k - 2 );

		}

	},

	Quintic: {

		In: function ( k ) {

			return k * k * k * k * k;

		},

		Out: function ( k ) {

			return --k * k * k * k * k + 1;

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1 ) return 0.5 * k * k * k * k * k;
			return 0.5 * ( ( k -= 2 ) * k * k * k * k + 2 );

		}

	},

	Sinusoidal: {

		In: function ( k ) {

			return 1 - Math.cos( k * Math.PI / 2 );

		},

		Out: function ( k ) {

			return Math.sin( k * Math.PI / 2 );

		},

		InOut: function ( k ) {

			return 0.5 * ( 1 - Math.cos( Math.PI * k ) );

		}

	},

	Exponential: {

		In: function ( k ) {

			return k === 0 ? 0 : Math.pow( 1024, k - 1 );

		},

		Out: function ( k ) {

			return k === 1 ? 1 : 1 - Math.pow( 2, - 10 * k );

		},

		InOut: function ( k ) {

			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( ( k *= 2 ) < 1 ) return 0.5 * Math.pow( 1024, k - 1 );
			return 0.5 * ( - Math.pow( 2, - 10 * ( k - 1 ) ) + 2 );

		}

	},

	Circular: {

		In: function ( k ) {

			return 1 - Math.sqrt( 1 - k * k );

		},

		Out: function ( k ) {

			return Math.sqrt( 1 - ( --k * k ) );

		},

		InOut: function ( k ) {

			if ( ( k *= 2 ) < 1) return - 0.5 * ( Math.sqrt( 1 - k * k) - 1);
			return 0.5 * ( Math.sqrt( 1 - ( k -= 2) * k) + 1);

		}

	},

	Elastic: {

		In: function ( k ) {

			var s, a = 0.1, p = 0.4;
			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( !a || a < 1 ) { a = 1; s = p / 4; }
			else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
			return - ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );

		},

		Out: function ( k ) {

			var s, a = 0.1, p = 0.4;
			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( !a || a < 1 ) { a = 1; s = p / 4; }
			else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
			return ( a * Math.pow( 2, - 10 * k) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) + 1 );

		},

		InOut: function ( k ) {

			var s, a = 0.1, p = 0.4;
			if ( k === 0 ) return 0;
			if ( k === 1 ) return 1;
			if ( !a || a < 1 ) { a = 1; s = p / 4; }
			else s = p * Math.asin( 1 / a ) / ( 2 * Math.PI );
			if ( ( k *= 2 ) < 1 ) return - 0.5 * ( a * Math.pow( 2, 10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) );
			return a * Math.pow( 2, -10 * ( k -= 1 ) ) * Math.sin( ( k - s ) * ( 2 * Math.PI ) / p ) * 0.5 + 1;

		}

	},

	Back: {

		In: function ( k ) {

			var s = 1.70158;
			return k * k * ( ( s + 1 ) * k - s );

		},

		Out: function ( k ) {

			var s = 1.70158;
			return --k * k * ( ( s + 1 ) * k + s ) + 1;

		},

		InOut: function ( k ) {

			var s = 1.70158 * 1.525;
			if ( ( k *= 2 ) < 1 ) return 0.5 * ( k * k * ( ( s + 1 ) * k - s ) );
			return 0.5 * ( ( k -= 2 ) * k * ( ( s + 1 ) * k + s ) + 2 );

		}

	},

	Bounce: {

		In: function ( k ) {

			return 1 - TWEEN.Easing.Bounce.Out( 1 - k );

		},

		Out: function ( k ) {

			if ( k < ( 1 / 2.75 ) ) {

				return 7.5625 * k * k;

			} else if ( k < ( 2 / 2.75 ) ) {

				return 7.5625 * ( k -= ( 1.5 / 2.75 ) ) * k + 0.75;

			} else if ( k < ( 2.5 / 2.75 ) ) {

				return 7.5625 * ( k -= ( 2.25 / 2.75 ) ) * k + 0.9375;

			} else {

				return 7.5625 * ( k -= ( 2.625 / 2.75 ) ) * k + 0.984375;

			}

		},

		InOut: function ( k ) {

			if ( k < 0.5 ) return TWEEN.Easing.Bounce.In( k * 2 ) * 0.5;
			return TWEEN.Easing.Bounce.Out( k * 2 - 1 ) * 0.5 + 0.5;

		}

	}

};

TWEEN.Interpolation = {

	Linear: function ( v, k ) {

		var m = v.length - 1, f = m * k, i = Math.floor( f ), fn = TWEEN.Interpolation.Utils.Linear;

		if ( k < 0 ) return fn( v[ 0 ], v[ 1 ], f );
		if ( k > 1 ) return fn( v[ m ], v[ m - 1 ], m - f );

		return fn( v[ i ], v[ i + 1 > m ? m : i + 1 ], f - i );

	},

	Bezier: function ( v, k ) {

		var b = 0, n = v.length - 1, pw = Math.pow, bn = TWEEN.Interpolation.Utils.Bernstein, i;

		for ( i = 0; i <= n; i++ ) {
			b += pw( 1 - k, n - i ) * pw( k, i ) * v[ i ] * bn( n, i );
		}

		return b;

	},

	CatmullRom: function ( v, k ) {

		var m = v.length - 1, f = m * k, i = Math.floor( f ), fn = TWEEN.Interpolation.Utils.CatmullRom;

		if ( v[ 0 ] === v[ m ] ) {

			if ( k < 0 ) i = Math.floor( f = m * ( 1 + k ) );

			return fn( v[ ( i - 1 + m ) % m ], v[ i ], v[ ( i + 1 ) % m ], v[ ( i + 2 ) % m ], f - i );

		} else {

			if ( k < 0 ) return v[ 0 ] - ( fn( v[ 0 ], v[ 0 ], v[ 1 ], v[ 1 ], -f ) - v[ 0 ] );
			if ( k > 1 ) return v[ m ] - ( fn( v[ m ], v[ m ], v[ m - 1 ], v[ m - 1 ], f - m ) - v[ m ] );

			return fn( v[ i ? i - 1 : 0 ], v[ i ], v[ m < i + 1 ? m : i + 1 ], v[ m < i + 2 ? m : i + 2 ], f - i );

		}

	},

	Utils: {

		Linear: function ( p0, p1, t ) {

			return ( p1 - p0 ) * t + p0;

		},

		Bernstein: function ( n , i ) {

			var fc = TWEEN.Interpolation.Utils.Factorial;
			return fc( n ) / fc( i ) / fc( n - i );

		},

		Factorial: ( function () {

			var a = [ 1 ];

			return function ( n ) {

				var s = 1, i;
				if ( a[ n ] ) return a[ n ];
				for ( i = n; i > 1; i-- ) s *= i;
				return a[ n ] = s;

			};

		} )(),

		CatmullRom: function ( p0, p1, p2, p3, t ) {

			var v0 = ( p2 - p0 ) * 0.5, v1 = ( p3 - p1 ) * 0.5, t2 = t * t, t3 = t * t2;
			return ( 2 * p1 - 2 * p2 + v0 + v1 ) * t3 + ( - 3 * p1 + 3 * p2 - 2 * v0 - v1 ) * t2 + v0 * t + p1;

		}

	}

};
