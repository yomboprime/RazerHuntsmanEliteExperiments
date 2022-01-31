/*

This example is MIT Licensed by github.com/yomboprime 2022


*/

// Requires

const RazerKeyboard = require( '../../lib/RazerKeyboard' );
const { spawn } = require( 'child_process' );
const pathJoin = require( 'path' ).join;
const fs = require( 'fs' );

// Global variables

// Configure here the path to the keyboard device:
const deviceFolder = '0003:1532:0226.0003';

// Configure here the audio device. If it doesn't work try one of the list that gives 'arecord -L'.
const audioDevice = 'default';

// Audio parameters
const sampleRate = 44100;
const stereo = true;

// Visualization parameters
const equalizerR = 255;
const equalizerG = 30;
const equalizerB = 10;
const equalizerUpdateHz = 10;

// -----

const keyb = new RazerKeyboard();
const rgb = [];

const linearOrder = createLinearOrder();

let audioChildProcess;
let audioLevelLeft = 0;
let audioLevelRight = 0;

let audioLevelLeftSmoothed = 0;
let audioLevelRightSmoothed = 0;

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

	keyb.initCustomMatrixMode( ( err ) => {

		if ( err ) {

			console.error( "Error initing matrix mode: " + err );
			return;

		}

		for ( let j = 0; j < keyb.numRows; j ++ ) {

			for ( let i = 0; i < keyb.numColumns; i ++ ) {

				rgb.push( Math.floor( Math.random() * 255 ) );
				rgb.push( Math.floor( Math.random() * 255 ) );
				rgb.push( Math.floor( Math.random() * 255 ) );

			}

		}

		// Turn off perimeter
		for ( let i = 0, n = linearOrder.length; i < n; i ++ ) paintIndex( i, 0, 0, 0 );

		// Update keyboard lights
		keyb.setCustomMatrix( 0, keyb.numRows, rgb, ( success ) => {

			if ( ! success ) {

				console.error( "Could not set keyboard colors." );
				terminate();
				return;

			}

			connectAudioProcess();

			updateEqualizer();

		} );



	} )

}

function updateEqualizer() {

	const levelL = audioLevelLeftSmoothed;
	const levelR = audioLevelRightSmoothed;

	audioLevelLeftSmoothed = Math.max( 0, audioLevelLeftSmoothed - 0.2 );
	audioLevelRightSmoothed = Math.max( 0, audioLevelRightSmoothed - 0.2 );

	for ( let i = 0; i < 15; i ++ ) {

		const key = linearOrder[ i ][ 0 ].i - 6.5;
		const isLeft = key < 0;
		const level = isLeft ? levelL : levelR;
		let keyLevel = Math.abs( key ) / 9;
		const v = level >= keyLevel ? Math.min( 1, level - keyLevel ) : 0;

		paintIndex(
			i + 22,
			equalizerR * v,
			equalizerG * v,
			equalizerB * v
		);

	}

	keyb.setCustomMatrix( 0, keyb.numRows, rgb, ( success ) => {

		if ( ! success ) {

			console.error( "Could not set keyboard colors." );
			terminate();
			return;

		}

		setTimeout( updateEqualizer, 1000 / equalizerUpdateHz );

	} );

}

function paintPixel( i, j, r, g, b ) {

	const p = ( i + j * keyb.numColumns ) * 3;
	rgb[ p ] = r;
	rgb[ p + 1 ] = g;
	rgb[ p + 2 ] = b;

}

function paintIndex( index, r, g, b ) {

	const order = linearOrder[ index ];
	for ( let o in order ) paintPixel( order[ o ].i, order[ o ].j, r, g, b );

}

function createLinearOrder() {

	// Creates a linear sequence order for the underglow side RGB LEDs of the Razer Hunstman Elite keyboard.

	const linearOrder = [];
	function addLinearOrder( i, j ) {

		linearOrder.push( [ { i: i, j: j } ] );

	}
	function addTwoLinearOrder( i1, j1, i2, j2 ) {

		linearOrder.push( [ { i: i1, j: j1 }, { i: i2, j: j2 } ]  );

	}

	// Rear and right side of the keyboard
	for ( let i = 0; i <= 18; i ++ ) addLinearOrder( i, 6 );

	// Right side of the rest
	addLinearOrder( 17, 8 );
	addLinearOrder( 18, 8 );
	addLinearOrder( 19, 8 );

	// Front side, both keyboard and rest
	for ( let i = 14; i >= 0; i -- ) addTwoLinearOrder(
		i + 4,
		7,
		i + 2,
		8
	);

	// Left side of the rest
	addLinearOrder( 1, 8 );
	addLinearOrder( 0, 8 );

	// Right side of the keyboard
	addLinearOrder( 3, 7 );
	addLinearOrder( 2, 7 );
	addLinearOrder( 1, 7 );
	addLinearOrder( 0, 7 );

	return linearOrder;

}

function connectAudioProcess() {

	const audioChannels = stereo ? 2 : 1;
	const samples = new Int16Array( audioChannels );
	const samplesView = new DataView( samples.buffer );
	const numberOfFrames = Math.floor( sampleRate / equalizerUpdateHz );

	function processAudioData( data ) {

		// The divisor is ( 2 * numChannels ), 2 bytes (16 bits) per sample, by number of channels.
		let numNewFrames = data.length >> audioChannels;

		let levelRight = 0;
		let levelLeft = 0;

		let p = 0;
		while ( numNewFrames > 0 ) {

			numNewFrames --;

			let i = 0;
			samplesView.setInt8( i ++, data[ p ++ ] );
			samplesView.setInt8( i ++, data[ p ++ ] );

			levelRight = Math.max( levelRight, Math.abs( samples[ 0 ] ) );

			if ( audioChannels === 2 ) {

				samplesView.setInt8( i ++, data[ p ++ ] );
				samplesView.setInt8( i ++, data[ p ++ ] );

				levelLeft = Math.max( levelLeft, Math.abs( samples[ 1 ] ) );

			}
			else levelLeft = levelRight;

		}

		audioLevelLeft = levelLeft / 32768;
		audioLevelRight = levelRight / 32768;
		audioLevelLeftSmoothed = Math.max( audioLevelLeftSmoothed, audioLevelLeft );
		audioLevelRightSmoothed = Math.max( audioLevelRightSmoothed, audioLevelRight );

	}

	audioChildProcess = spawn( "arecord", [
		"-D", "" + audioDevice,
		"-c", "" + audioChannels,
		"-r", "" + sampleRate,
		"-f", "S16_LE",
		"--buffer-size=" + numberOfFrames
	], { stdio: [ 'ignore', 'pipe', 'pipe'] } );

	audioChildProcess.stdout.on( 'data', processAudioData );

	audioChildProcess.stderr.setEncoding( 'utf8' );
	audioChildProcess.stderr.on( 'data', ( data ) => {

		console.error( "Audio message: " + data );

	} );

	audioChildProcess.on( 'close', ( code ) => {

		console.error( "Audio disconnected." );
		audioChildProcess = null;

	} );

}

function terminate() {

	if ( audioChildProcess ) {

		audioChildProcess.kill( 'SIGINT' );

	}

	keyb.finishCustomMatrixMode( () => {

		process.exit( 0 );

	} );

}
