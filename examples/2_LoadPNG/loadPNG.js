/*

This example is MIT Licensed by github.com/yomboprime 2022


*/

// Requires

const RazerKeyboard = require( '../../lib/RazerKeyboard' );
const { decode } = require( 'fast-png' );
const pathJoin = require( 'path' ).join;
const fs = require( 'fs' );

// Global variables

// Configure here the path to the keyboard device:
const deviceFolder = '0003:1532:0226.0003';

// Configure here PNG image filename
const imagePath = './yombo.png';

const keyb = new RazerKeyboard();


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
	makeTest();

}

function makeTest() {

	const image = decode( fs.readFileSync( pathJoin( __dirname, imagePath ) ) );

	if ( ! image ) {

		console.error( "Could not load " + imagePath );
		return;

	}

	if ( image.width !== keyb.numColumns || image.height !== keyb.numRows || image.depth !== 8 || ( image.channels !== 3 && image.channels !== 4 ) ) {

		console.error( "Image must be " + keyb.numColumns + "x" + keyb.numRows + " pixels and three or four 8 bit channels (RGB24 or RGBA32)" );
		return;

	}

	keyb.initCustomMatrixMode( ( err ) => {

		if ( err ) {

			console.error( "Error initing matrix mode: " + err );
			return;

		}

		const rgb = [];

		let p = 0;
		for ( let j = 0; j < keyb.numRows; j ++ ) {

			for ( let i = 0; i < keyb.numColumns; i ++ ) {

				rgb.push( image.data[ p ++ ] );
				rgb.push( image.data[ p ++ ] );
				rgb.push( image.data[ p ++ ] );

				if ( image.channels === 4 ) p ++;

			}

		}

		// Update keyboard lights
		keyb.setCustomMatrix( 0, keyb.numRows, rgb, ( success ) => {

			if ( ! success ) {

				console.error( "Could not set keyboard colors." );
				terminate();
				return;

			}

		} );



	} )

}

function terminate() {

	keyb.finishCustomMatrixMode( () => {

		process.exit( 0 );

	} );

}
