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

	const startRow = 6;
	const endRow = 9;

	const levelL = audioLevelLeftSmoothed;
	const levelR = audioLevelRightSmoothed;

	audioLevelLeftSmoothed = Math.max( 0, audioLevelLeftSmoothed - 0.2 );
	audioLevelRightSmoothed = Math.max( 0, audioLevelRightSmoothed - 0.2 );

	let p = startRow * keyb.numColumns * 3;
	for ( let j = startRow; j <= endRow; j ++ ) {

		for ( let i = 0; i < keyb.numColumns; i ++ ) {

			let keyV1 = Math.abs( i - 10 ) / 10;

			const v = levelL >= keyV1 ? Math.min( 1, levelL - keyV1 ) : 0;

			rgb[ p ++ ] = Math.floor( equalizerR * v );
			rgb[ p ++ ] = Math.floor( equalizerG * v );
			rgb[ p ++ ] = Math.floor( equalizerB * v );

		}

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

function connectAudioProcess() {

	const audioChannels = stereo ? 2 : 1;
	var samples = new Int16Array( audioChannels );
	var samplesView = new DataView( samples.buffer );
	var numberOfFrames = Math.floor( sampleRate / equalizerUpdateHz );

	function processAudioData( data ) {

		// The divisor is ( 2 * numChannels ), 2 bytes (16 bits) per sample, by number of channels.
		let numNewFrames = data.length >> audioChannels;

		let levelLeft = 0;
		let levelRight = 0;

		let p = 0;
		while ( numNewFrames > 0 ) {

			numNewFrames --;

			let i = 0;
			samplesView.setInt8( i ++, data[ p ++ ] );
			samplesView.setInt8( i ++, data[ p ++ ] );

			levelLeft = Math.max( levelLeft, Math.abs( samples[ 0 ] ) );

			if ( audioChannels === 2 ) {

				samplesView.setInt8( i ++, data[ p ++ ] );
				samplesView.setInt8( i ++, data[ p ++ ] );

				levelRight = Math.max( levelRight, Math.abs( samples[ 1 ] ) );

			}
			else levelRight = levelLeft;

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
