<?php

/**
 * Copyright (c) 2013 Humu <humu2009@gmail.com>
 * This file is part of the Pano.js project. It can be freely distributed under 
 * the terms of the MIT license.
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

/**
 * Based on code originally provided by Shinya Muramatsu <revulon@gmail.com>, 
 * and published under the MIT license.
 */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

	// set correct MIME type for response
	header('Content-Type: application/octet-stream');

	if (isset($_POST['dataurl'])) {
		// get the submitted stuff
		$data = $_POST['dataurl'];

		if (preg_match('/^data:image\/([a-zA-Z0-9]+);base64,/', $data, $matches)) {
			$basename = isset($_POST['basename']) ? $_POST['basename'] : 'screenshot';

			// force the response to be a downloadable file with correct file name
			header('Content-Disposition: attachment; filename="' . $basename . '.' . (($matches[1] === 'jpeg') ? 'jpg' : $matches[1]) . '"');

			// remove leading sections of the data URL
			$data = substr($data, strpos($data, ',') + 1);
			// Replace whitespaces, if any, with '+'. 
			// See http://stackoverflow.com/questions/7291183/decoding-a-canvas-todataurl.
			$data = str_replace(' ', '+', $data);

			// decode the base64-encoded data and send it back to client side 
			echo base64_decode($data);
		}
	}

}

?>