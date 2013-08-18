/**
	@preserve Copyright (c) 2013 Humu humu2009@gmail.com
	Pano.js can be freely distributed under the terms of the MIT license.

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in
	all copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
	THE SOFTWARE.
**/


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
	var is_firefox = /Firefox[\/\s]\d+(?:.\d+)*/.exec(window.navigator.userAgent) != null;

	var requestAnimationFrame = window.requestAnimationFrame || function(callback) {
		setTimeout(callback, 17);
	};

	var util_canvas = null;

	var vert_shader =	'#ifdef GL_ES \n' + 
						'	precision mediump float; \n' + 
						'#endif	\n' + 
						'attribute vec2 a_position; \n' + 
						'varying vec2 v_fraction; \n' + 
						'void main(void) { \n' + 
						'	v_fraction = vec2(0.5, -0.5) * a_position + vec2(0.5, 0.5); \n' + 
						'	gl_Position = vec4(a_position, 0.0, 1.0); \n' + 
						'}';
	var frag_shader =	'#ifdef GL_ES \n' + 
						'	precision mediump float; \n' + 
						'#endif	\n' + 
						'#define PI 3.1415927 \n' + 
						'uniform vec3 u_camDir; \n' + 
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

	function clamp(val, min, max) {
		return Math.max(min, Math.min(max, val));
	}

	function makeSFVec() {
		return window.Float32Array ? (new window.Float32Array(arguments)) : Array.prototype.slice.call(arguments, 0);
	}

	function getUtilCanvas() {
		return util_canvas ? util_canvas : (util_canvas = document.createElement('canvas'));
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

	function isPowerOfTwo(n) {
		return (n & (n - 1)) == 0;
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

		var forceWebGLRendering = false;
		var forceSoftwareRendering = false;
		if (params) {
			if ((typeof params['heading']) == 'number')
				this.init_heading = params['heading'];
			if ((typeof params['pitch']) == 'number')
				this.init_pitch = clamp(params['pitch'], 0, 180);
			if ((typeof params['fov']) == 'number')
				this.init_fov = clamp(params['fov'], 30, 90);
			if ((typeof params['image']) == 'string' && params['image'] != '')
				this.load(params['image']);
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
		});
		this.canvas.addEventListener('mouseup', function(evt) {
			self.button_states[evt.button] = false;
			evt.preventDefault();
		});
		this.canvas.addEventListener('mousemove', function(evt) {
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
			evt.preventDefault();
		});
		this.canvas.addEventListener(is_firefox ? 'DOMMouseScroll' : 'mousewheel', function(evt) {
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
			evt.preventDefault();
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
			this.renderer = new Canvas2DRenderer(this);
		}

		this.on_load_handler = null;
		this.enter_frame_handler = null;
		this.exit_frame_handler = null;

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
			if (self.dirty) {
				// lower idle flag
				self.idle = false;
				// draw a new frame and see if there are more animations
				var has_next_frame = false;
				if (self.inertial_move == 'on') {
					has_next_frame = inertial_yaw();
					has_next_frame = inertial_zoom() || has_next_frame;
				}
				self.draw();
				self.dirty = has_next_frame;
				
			}
			else if (!self.idle && (Date.now() - self.last_draw_ms >= 250)) {
				// raise idle flag
				self.idle = true;
				// draw a new frame with texture filtering on
				if (!self.is_webgl_enabled && self.image_filtering == 'on-idle')
					self.draw();
			}
			setTimeout(tick, 30);
		};

		tick();
	}

	View.prototype = {

		get domElement() {
			return this.canvas;
		}, 

		get isMaximized() {
			return this.saved_canvas_pos != null;
		}, 

		get onLoad() {
			return this.on_load_handler;
		}, 

		set onLoad(callback) {
			if (!callback || (typeof callback) == 'function')
				this.on_load_handler = callback;
		}, 

		get onEnterFrame() {
			return this.enter_frame_handler;
		}, 

		set onEnterFrame(callback) {
			if (!callback || (typeof callback) == 'function')
				this.enter_frame_handler = callback;
		}, 

		get onExitFrame() {
			return this.exit_frame_handler;
		}, 

		set onExitFrame(callback) {
			if (!callback || (typeof callback) == 'function')
				this.exit_frame_handler = callback;
		}, 

		load: function(url, reset) {
			var self = this;
			var img = new Image;
			img.onload = function() {
				if (reset || reset == undefined) {
					self.cam_heading = self.init_heading;
					self.cam_pitch = self.init_pitch;
					self.cam_fov = self.init_fov;
				}
				if (self.on_load_handler)
					self.on_load_handler.call(null, self);
				self.renderer.setImage(this);
				self.update();
			};
			img.src = url;
		}, 

		reset: function() {
			this.cam_heading = this.init_heading;
			this.cam_pitch = this.init_pitch;
			this.cam_fov = this.init_fov;
			this.update();
		}, 

		yaw: function(degs) {
			var newHeading = this.cam_heading + degs;
			if (Math.abs(newHeading - this.cam_heading) > 0) {
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
				this.cam_fov = newFov;
				this.update();
			}
		}, 

		jumpTo: function(heading, pitch, fov) {
			this.cam_heading = heading;
			this.cam_pitch = clamp(pitch, 0, 180);
			this.cam_fov = clamp(fov, 30, 90);
			this.update();
		}, 

		navigateTo: function(heading, pitch, fov, interval) {
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

				// redraw with the new size
				this.update();
			}
		}, 

		update: function() {
			this.dirty = true;
		}, 

		draw: function() {
			// Adjust canvas's logical size to be the same as its inner size in pixels. 
			// This is necessary for canvas may have been resized.
			if (this.canvas.width != this.canvas.clientWidth)
				this.canvas.width = this.canvas.clientWidth;
			if (this.canvas.height != this.canvas.clientHeight)
				this.canvas.height = this.canvas.clientHeight;

			if (this.enter_frame_handler)
				this.enter_frame_handler.call(null, this, this.canvas.width, this.canvas.height);

			/*
			 * Calculate current camera plane.
			 */
			var heading = this.cam_heading;
			var pitch = this.cam_pitch;
			var fov = this.cam_fov;
			var camPlane = this.cam_plane;
			var ratioUp = 2.0 * Math.tan(0.5 * fov * DEG2RAD);
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
			this.renderer.render(camPlane.origin, camPlane.dir, camPlane.up, camPlane.right);

			// update timestamp
			this.last_draw_ms = Date.now();

			if (this.exit_frame_handler)
				this.exit_frame_handler.call(null, this, this.canvas.width, this.canvas.height);
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
	}

	Canvas2DRenderer.prototype = {

		setImage: function(img) {
			var cv = getUtilCanvas();
			var w = img.width;
			var h = img.height;

			var isClean = false;
			if (cv.width != w || cv.height != h) {
				cv.width = w;
				cv.height = h;
				isClean = true;
			}

			var ctx = cv.getContext('2d');
			if (!isClean)
				ctx.clearRect(0, 0, w, h);
			ctx.drawImage(img, 0, 0, w, h);
			var imgData = ctx.getImageData(0, 0, w, h);
			cv.width = 0;
			cv.height = 0;

			this.img_pixels = imgData.data;
			this.img_width = w;
			this.img_height = h;
		}, 

		render: function(origin, dir, up, right) {
			if (!this.ctx2d || !this.img_pixels)
				return;

			// data buffer should be reallocated if canvas size has changed
			if (this.canvas_width != this.canvas.width || this.canvas_height != this.canvas.height) {
				this.canvas_width = this.canvas.width;
				this.canvas_height = this.canvas.height;
				this.canvas_data = null;
			}

			var srcWidth = this.img_width;
			var srcHeight = this.img_height;
			var destWidth = this.canvas.width;
			var destHeight = this.canvas.height;

			if (!this.canvas_data)
				this.canvas_data = this.ctx2d.getImageData(0, 0, destWidth, destHeight);
			var data = this.canvas_data.data;

			var useBilinear = this.view.image_filtering == 'on' || (this.view.idle && this.view.image_filtering == 'on-idle');

			/*
			 *	The idea is rather straightforward: calculate a ray for each pixel on canvas using the camera plane. Then  
			 *	calculate corresponding texture coordinates from the spherical coodinates (phi, theta) to get correct texels. 
			 *	For efficiency, we only do the calculation per 8 pixels and linearly interpolate texels inside each piece.
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

					// the ray for the end pixel of current piece
					rayX = origin[0] + right[0] * x - up[0] * y;
					rayY = origin[1] + right[1] * x - up[1] * y;
					rayZ = origin[2] + right[2] * x - up[2] * y;
					rayLen = Math.sqrt(rayX * rayX + rayY * rayY + rayZ * rayZ);
					
					// tex coords for the end pixel of current piece
					var theta1 = thetaFactor * Math.acos(rayY / rayLen);
					var phi1 = phiFactor * (Math.atan2(rayZ, rayX) + Math.PI);

					// tex coord increments
					var deltaTheta = theta1 - theta0;
					var deltaPhi = phi1 - phi0;
					var thetaInc256 = ~~(256 * deltaTheta / rl);
					var phiInc256;
					if (deltaPhi < -srcHalfWidth)		// the piece passes through the right image boundary
						phiInc256 = ~~(256 * (srcWidth + deltaPhi) / rl);
					else if (deltaPhi > srcHalfWidth)	// the piece passes through the left image boundary
						phiInc256 = ~~(256 * (-srcWidth + deltaPhi) / rl);
					else
						phiInc256 = ~~(256 * deltaPhi / rl);

					/*
					 *	Calculate texels for each pixel inside this piece using linear interpolation method.
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
						// Apply bilinear filtering.
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

					// continue to next piece, if any
					theta0 = theta1;
					phi0 = phi1;
				} while (!isDone);
			}

			this.ctx2d.putImageData(this.canvas_data, 0, 0);
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
		this.program = null;
		this.canvas_quad = null;
		this.img_texture = null;
		this.img_width = 0;
		this.img_height = 0;
	}

	WebGLRenderer.prototype = {

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

		render: function(origin, dir, up, right) {
			if (!this.gl || !this.img_texture)
				return;

			var gl = this.gl;
			var canvasWidth = this.canvas.width;
			var canvasHeight = this.canvas.height;

			if (!this.program)
				this.program = createProgram(gl, vert_shader, frag_shader);

			if (!this.canvas_quad) {
				this.canvas_quad = {};
				this.canvas_quad.coords = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, this.canvas_quad.coords);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
				gl.bindBuffer(gl.ARRAY_BUFFER, null);
			}

			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.viewport(0, 0, canvasWidth, canvasHeight);

			gl.disable(gl.BLEND);
			gl.disable(gl.DEPTH_TEST);
			gl.depthMask(false);

			gl.useProgram(this.program);

			// update uniforms
			gl.uniform3fv(gl.getUniformLocation(this.program, 'u_camDir'), dir);
			gl.uniform3fv(gl.getUniformLocation(this.program, 'u_camUp'), up);
			gl.uniform3fv(gl.getUniformLocation(this.program, 'u_camRight'), right);
			gl.uniform3fv(gl.getUniformLocation(this.program, 'u_camPlaneOrigin'), origin);

			// set sampler
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.img_texture);
			gl.uniform1i(gl.getUniformLocation(this.program, 's_texture'), 0);

			// render to canvas
			gl.enableVertexAttribArray(0);
			gl.bindBuffer(gl.ARRAY_BUFFER, this.canvas_quad.coords);
			gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
			gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
			gl.bindTexture(gl.TEXTURE_2D, null);

			gl.flush();
		}

	};


	Pano.View = View;

}) ();
