/*

This class library for Razer Keyboards is MIT Licensed by github.com/yomboprime 2022


*/

const fs = require( 'fs' );
const pathJoin = require( 'path' ).join;

const ASCII_0 = 48;
const ASCII_1 = 49;
const ASCII_2 = 50;

class RazerKeyboard {

	constructor() {

		this.devicePath = '/sys/bus/hid/drivers/razerkbd';
		this.deviceFolderName = '';

		this.writeMatrixFileHandle = null;
		this.setMatrixFileHandle = null;

		this.numRows = 9;
		this.numColumns = 22;

		this.matrixBuffer = null;
		this.buffer1B = Buffer.alloc( 1 );
		this.buffer3B = Buffer.alloc( 3 );
		this.buffer4B = Buffer.alloc( 4 );
		this.buffer6B = Buffer.alloc( 6 );
		this.buffer7B = Buffer.alloc( 7 );

	}

	//
	// API functions
	//

	setDeviceFolderName( deviceFolderName ) {

		// Sets device folder name (under the folder this.devicePath), which identifies the device to control.
		// Don't use while custom matrix mode is inited.

		this.deviceFolderName = deviceFolderName;
	}

	getType( callback ) {

		// Gets device full name. 'callback' receives ( err, deviceType )

		this.readFile( 'device_type', callback );

	}

	getSerialNumber( callback ) {

		// Gets device serial number. 'callback' receives ( err, serial )

		this.readFile( 'device_serial', callback );

	}

	getFirmwareVersion( callback ) {

		// Gets device firmware version. 'callback' receives ( err, firmwareVersion )

		this.readFile( 'firmware_version', callback );

	}

	initCustomMatrixMode( onInited ) {

		// Starts custom matrix mode by opening the 'matrix_custom_frame' and 'matrix_effect_custom' files.
		// 'onInited' gets error as parameter or null on success.

		const scope = this;

		if ( this.writeMatrixFileHandle ) {

			this.finish( () => {

				openMatrix();

			} )

		} else openMatrix();

		function openMatrix() {

			scope.openFile( 'matrix_custom_frame', ( err, fd ) => {

				if ( err ) {

					onInited( err );

				} else {

					scope.writeMatrixFileHandle = fd;

					scope.openFile( 'matrix_effect_custom', ( err2, fd2 ) => {

						if ( err2 ) {

							scope.finish( () => {

								onInited( err2 );

							} )

						} else {

							scope.setMatrixFileHandle = fd2;
							scope.createMatrixBuffer();
							onInited( null );
						}

					} );

				}

			} );

		}

	}

	setCustomMatrix( firstRow, rowCount, rgb, onRGBSet ) {

		// Sets RGB color of a number of keyboard key rows.
		// 'initCustomMatrixMode' must be called prior to this one.
		// firstRow and rowCount define the rows to be updated.
		// rgb is array of rowCount * this.numColumns * 3 bytes (RGB image)
		// 'onRGBSet' gets boolean success as parameter.

		const scope = this;

		if ( ! this.writeMatrixFileHandle ) {

			onRGBSet( false );
			return;

		}

		let p = 0;
		for ( let row = firstRow; row < rowCount; row ++ ) {

			this.matrixBuffer[ p ++ ] = row;
			this.matrixBuffer[ p ++ ] = 0;
			this.matrixBuffer[ p ++ ] = 21;

			for ( let column = 0; column < this.numColumns; column ++ ) {

				const rgbp = 3 * ( row * this.numColumns + column );
				this.matrixBuffer[ p ++ ] = rgb[ rgbp ];
				this.matrixBuffer[ p ++ ] = rgb[ rgbp + 1 ];
				this.matrixBuffer[ p ++ ] = rgb[ rgbp + 2 ];

			}
		}

		const numBytes = rowCount * 3 * ( 1 + this.numColumns );

		fs.write( this.writeMatrixFileHandle, this.matrixBuffer, 0, numBytes, ( err, bytesWritten, buf ) => {

			scope.buffer1B[ 0 ] = ASCII_1;
			fs.write( scope.setMatrixFileHandle, scope.buffer1B, ( err2, bytesWritten, buf ) => {

				onRGBSet( err || err2  ? false : true );

			} );

		} );

	}

	finishCustomMatrixMode( onFinished ) {

		// Finishes the matrix mode. The keyboard will remain with the current colors.
		// 'onFinished' does not get parameters.

		const scope = this;

		if ( this.writeMatrixFileHandle ) {

			fs.close( this.writeMatrixFileHandle, () => {

				if ( scope.setMatrixFileHandle ) {

					fs.close( scope.setMatrixFileHandle, () => {

						scope.setMatrixFileHandle = null;
						scope.writeMatrixFileHandle = null;
						onFinished();

					} );

				} else {

					scope.setMatrixFileHandle = null;
					scope.writeMatrixFileHandle = null;
					onFinished();

				}

			} );

		} else onFinished();

	}

	setBreatheEffectMode( color1R, color1G, color1B, color2R, color2G, color2B, onSet ) {

		// Sets breathe effect mode.
		// color1 and color2 consist of R, G and B which are numbers fron 0 to 255.
		// If color1R === undefined, color1 and color2 are not defined.
		// Else if color2R === undefined, only color1 is defined.
		// Else color1 and color2 are defined.
		// In the first case, pseudo-random colors are used to fade in and out.
		// In the second case, color1 is used to fade in and out.
		// In the third case, color is fade in and out between color1 and color2.
		// 'onSet' callback gets error as parameter or null on success

		const commandFilename = 'matrix_effect_breath';

		if ( color1R === undefined ) {

			this.buffer1B[ 0 ] = ASCII_1;
			this.writeBufferToFile( commandFilename, this.buffer1B, onSet );

		} else if ( color2R === undefined ) {

			this.buffer3B[ 0 ] = color1R;
			this.buffer3B[ 1 ] = color1G;
			this.buffer3B[ 2 ] = color1B;
			this.writeBufferToFile( commandFilename, this.buffer3B, onSet );

		} else {

			this.buffer6B[ 0 ] = color1R;
			this.buffer6B[ 1 ] = color1G;
			this.buffer6B[ 2 ] = color1B;
			this.buffer6B[ 3 ] = color2R;
			this.buffer6B[ 4 ] = color2G;
			this.buffer6B[ 5 ] = color2B;
			this.writeBufferToFile( commandFilename, this.buffer6B, onSet );

		}

	}

	setStarlightEffectMode( speed, color1R, color1G, color1B, color2R, color2G, color2B, onSet ) {

		// Sets starlight effect mode.
		// Speed is the speed of changing colors.
		// color1 and color2 consist of R, G and B which are numbers fron 0 to 255.
		// If color1R === undefined, color1 and color2 are not defined.
		// Else if color2R === undefined, only color1 is defined.
		// Else color1 and color2 are defined.
		// In the first case, pseudo-random colors are used.
		// In the second case, color1 is used.
		// In the third case, color1 and color2 are used.
		// 'onSet' callback gets error as parameter or null on success

		const commandFilename = 'matrix_effect_starlight';

		if ( color1R === undefined ) {

			this.buffer1B[ 0 ] = speed;
			this.writeBufferToFile( commandFilename, this.buffer1B, onSet );

		} else if ( color2R === undefined ) {

			this.buffer4B[ 0 ] = speed;
			this.buffer4B[ 1 ] = color1R;
			this.buffer4B[ 2 ] = color1G;
			this.buffer4B[ 3 ] = color1B;
			this.writeBufferToFile( commandFilename, this.buffer4B, onSet );

		} else {

			this.buffer7B[ 0 ] = speed;
			this.buffer7B[ 1 ] = color1R;
			this.buffer7B[ 2 ] = color1G;
			this.buffer7B[ 3 ] = color1B;
			this.buffer7B[ 4 ] = color2R;
			this.buffer7B[ 5 ] = color2G;
			this.buffer7B[ 6 ] = color2B;
			this.writeBufferToFile( commandFilename, this.buffer7B, onSet );

		}

	}

	setReactiveEffectMode( speed, colorR, colorG, colorB, onSet ) {

		// Sets reactive effect mode.
		// Speed is the speed of changing colors. Must be 1 to 3.
		// color consist of R, G and B which are numbers fron 0 to 255.
		// 'onSet' callback gets error as parameter or null on success

		if ( ! Number.isInteger( speed ) || speed < 1 || speed > 3 ) {

			onSet( "RazerKeyboard.setReactiveMode(): speed must be 1 to 3." );
			return;

		}

		this.buffer4B[ 0 ] = speed;
		this.buffer4B[ 1 ] = colorR;
		this.buffer4B[ 2 ] = colorG;
		this.buffer4B[ 3 ] = colorB;

		this.writeBufferToFile( 'matrix_effect_reactive', this.buffer4B, onSet );

	}

	setSpectrumEffectMode( onSet ) {

		// Sets spectrum effect mode.
		// 'onSet' gets error as parameter or null on success.

		this.buffer1B[ 0 ] = 0;
		this.writeBufferToFile( 'matrix_effect_spectrum', this.buffer1B, onSet );

	}

	setStaticEffectMode( colorR, colorG, colorB, onSet ) {

		// Sets static effect mode.
		// color consist of R, G and B which are numbers fron 0 to 255.
		// 'onSet' gets error as parameter or null on success.

		this.buffer3B[ 0 ] = colorR;
		this.buffer3B[ 1 ] = colorG;
		this.buffer3B[ 2 ] = colorB;
		this.writeBufferToFile( 'matrix_effect_static', this.buffer3B, onSet );

	}

	setWaveEffectMode( toTheLeft, onSet ) {

		// Sets wave effect mode. Waves go to the left (parameter true) or right (false)
		// 'onSet' gets error as parameter or null on success.

		this.buffer1B[ 0 ] = toTheLeft ? ASCII_2 : ASCII_1;
		this.writeBufferToFile( 'matrix_effect_wave', this.buffer1B, onSet );

	}

	setNoEffectMode( onSet ) {

		// Sets 'no effect' mode.
		// 'onSet' gets error as parameter or null on success.

		this.buffer1B[ 0 ] = 0;
		this.writeBufferToFile( 'matrix_effect_none', this.buffer1B, onSet );

	}

	setGameModeLED( turnOn, onSet ) {

		// Turns on or off the game mode LED.
		// 'onSet' gets error as parameter or null on success

		this.buffer1B[ 0 ] = turnOn ? ASCII_1 : ASCII_0;
		this.writeBufferToFile( 'game_led_state', this.buffer1B, onSet );
	}

	setMacroLED( turnOn, onSet ) {

		// Turns on or off the macro LED.
		// 'onSet' gets error as parameter or null on success

		this.buffer1B[ 0 ] = turnOn ? ASCII_1 : ASCII_0;
		this.writeBufferToFile( 'macro_led_state', this.buffer1B, onSet );

	}

	setMacroLEDBlinking( turnOn, onSet ) {

		// Turns on or off the macro LED blinking mode. The LED must be already turned on for this to take effect.
		// 'onSet' gets error as parameter or null on success

		this.buffer1B[ 0 ] = turnOn ? ASCII_1 : ASCII_0;
		this.writeBufferToFile( 'macro_led_effect', this.buffer1B, onSet );

	}


	//
	// Internal functions
	//

	createMatrixBuffer() {

		// Length = rows * ( ( 1 byte row index + 1 byte start + 1 byte end ) + columns * 3 rgb bytes per LED )
		const bufferLength = this.numRows * ( 3 + this.numColumns * 3 );

		this.matrixBuffer = Buffer.alloc( bufferLength );
	}

	openFile( fileName, onOpen ) {

		fs.open( this.getCommandFilePath( fileName ), 'w', onOpen );

	}

	getCommandFilePath( fileName ) {

		return pathJoin( this.devicePath, this.deviceFolderName, fileName );	}

	writeBufferToFile( fileName, buffer, onWritten ) {

		// 'onWritten' gets error as parameter or null on success

		fs.writeFile( this.getCommandFilePath( fileName ), buffer, onWritten );

		/*
		this.openFile( fileName, ( err, fd ) => {

			if ( err ) {

				onWritten( err );
				return;

			}

			fs.write( fd, buffer, ( err2, bytesWritten, buf ) => {

				fs.close( fd, () => {

					onWritten( err2 );

				} );

			} );

		} );
		*/

	}

	readFile( fileName, onRead ) {

		// 'onRead' gets ( err, data )

		fs.readFile( this.getCommandFilePath( fileName ), onRead );

	}



}

module.exports = RazerKeyboard;
