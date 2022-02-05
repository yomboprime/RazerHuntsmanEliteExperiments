/*

This example is MIT Licensed by github.com/yomboprime 2022


*/

// Requires

const { spawn } = require( 'child_process' );
const RazerKeyboard = require( '../../lib/RazerKeyboard' );


// Global variables

// Configure here the path to the keyboard device:
const deviceFolder = '0003:1532:0226.0003';

// Configure here update period in ms
const period = 150;

const keyb = new RazerKeyboard();
const rgb = [];
let audioDeviceIndex;
let firstFrame = true;


// Main code

init();


// Functions

function init() {

	process.title = "razerTest";

	// Termination signal
	process.on( "SIGINT", function() {

		console.error( " SIGINT Signal Received, shutting down." );

		terminate();

	} );

	// Configure the path to the keyboard device
	keyb.setDeviceFolderName( deviceFolder );

	// Get the index to the current output audio device, and make the test
	getSystemAudioDeviceIndex( makeTest );

}

function makeTest( audioIndex ) {

	audioDeviceIndex = audioIndex;

	if ( audioDeviceIndex === -1 ) {

		console.error( "Could not get current output audio device index." );
		terminate();
		return;

	}

	keyb.initCustomMatrixMode( ( err ) => {

		if ( err ) {

			console.error( "Error initing matrix mode: " + err );
			return;

		}

		// Create an array of one row of keys colors, initially set to random values

		for ( let j = 0; j < keyb.numRows; j ++ ) {

			for ( let i = 0; i < keyb.numColumns; i ++ ) {

				rgb.push( Math.floor( Math.random() * 255 ) );
				rgb.push( Math.floor( Math.random() * 255 ) );
				rgb.push( Math.floor( Math.random() * 255 ) );

			}

		}

		// Start updating wheel colors
		setTimeout( setWheelColorToAudioVolume, period );

	} )

}

function setWheelColorToAudioVolume( callback ) {

	getSystemAudioVolume( audioDeviceIndex, ( volume ) => {

		const volumeUnit = volume / 65535;
		// Adjust color curve
		const volumeColor = Math.pow( volumeUnit, 2 );

		// Assign color to volume wheel (key 21 in first row; R, G and B values)
		const r = 0;
		const g = Math.max( 0, Math.min( 255, Math.round( volumeColor * 255 ) ) );
		const b = 0;

		rgb[ 21 * 3 ] = r;
		rgb[ 21 * 3 + 1 ] = g;
		rgb[ 21 * 3 + 2] = b;

		const numRows = firstFrame ? 9 : 1;
		firstFrame = false;

		// Update keyboard lights
		keyb.setCustomMatrix( 0, numRows, rgb, ( success ) => {

			if ( ! success ) {

				console.error( "Could not set keyboard colors." );
				terminate();
				return;

			}

			setTimeout( setWheelColorToAudioVolume, period );

		} );

	} );

}

function getSystemAudioDeviceIndex( callback ) {

	// Callback receives audio device index or - 1 if error

	spawnProgram( null, "pacmd", [ "list-sources" ], ( code, output, error ) => {

		if ( error ) {

			callback( -1 );
			return;

		}

		const lines = output.split( '\n' );
		for ( let l in lines ) {

			const line = lines[ l ].trim();
			const indexStr = '* index: ';
			const indexPos = line.indexOf( indexStr );
			if ( indexPos >= 0 ) {

				const index = parseInt( line.substring( indexPos + indexStr.length ) );
				if ( ! isNaN( index ) ) {

					callback( index );

				}
				else {

					callback( -1 );
				}
				return;

			}

		}

		callback( -1 );

	}, false );

}

function getSystemAudioVolume( audioDeviceIndex, callback ) {

	// Callback receives volume from 0 to 65535 or -1 if error

	spawnProgram( null, "pacmd", [ "dump-volumes" ], ( code, output, error ) => {

		if ( error ) {

			callback( - 1 );
			return;

		}

		const sinkString = 'Sink ' + audioDeviceIndex + ':';

		const lines = output.split( '\n' );
		for ( let l in lines ) {

			const line = lines[ l ];

			if ( line.startsWith( sinkString ) ) {

				const frontLeftPos = line.indexOf( 'front-left:' );
				if ( frontLeftPos >= 0 ) {

					const frontLeftPosEnd = frontLeftPos + 'front-left:'.length;
					const barPos = line.indexOf( '/', frontLeftPosEnd );

					if ( barPos >= 0 ) {

						const volume = parseInt( line.substring( frontLeftPosEnd + 1, barPos ) );
						if ( ! isNaN( volume ) ) {

							callback( Math.max( 0, Math.min( 65535, volume ) ) );
							return;

						}

					}

				}

				callback( volume );
				return;

			}

		}

		callback( -1 );

	}, false );

}

function spawnProgram( cwd, program, args, callback, cancelOutput ) {

	var p;

	if ( cwd ) p = spawn( program, args, { cwd: cwd } );
	else p = spawn( program, args );

	var output = "";
	var error = "";

	p.stdout.on( 'data', ( data ) => {

		if ( cancelOutput === false ) output += data;

	} );

	p.stderr.on( 'data', ( data ) => {

		error += data;

	} );

	p.on( 'exit', ( code, signal ) => {

		if ( callback ) {

			callback( code, output, error );

		}

	} );

}

function terminate() {

	keyb.finishCustomMatrixMode( () => {

		process.exit( 0 );

	} );

}
