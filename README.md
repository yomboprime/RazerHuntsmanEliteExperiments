# RazerHuntsmanEliteExperiments
Experiments with RGB LEDs of Razer Huntsman Elite keyboard and other devices from Razer.

## Install

For all the examples you need Node.js and the OpenRazer driver installed.

Just clone this repository and cd to each of the examples subfolders to execute them.

Some examples have npm dependencies. If there is a ```package.json``` file in them, you need to do

```shell
npm install
```



## Examples

## Example 1: Fade the volume wheel

This example fades the volume wheel color of a Razer Hunstman Elite keyboard as it is spinned, according to the current audio volume level.

**Requirement**: You will need ```pacmd``` installed on your system.

#### How to run

First, obtain the subfolder for your keyboard under ```/sys/bus/hid/drivers/razerkbd```. Do this:

```shell
ls /sys/bus/hid/drivers/razerkbd
```

One of the subfolders with ```1536_0226``` in its name will be your keyboard interface (usually the one that contains more files).

Then edit the ```volumeWheel.js``` file, find in it the string ```const deviceFolder = '0003:1532:0226.0003';``` and change the string to your keyboards subfolder filename you just found.

Then, to execute the script:

```shell
cd examples/1_VolumeWheel/
node volumeWheel.js
```

To stop, press ```Ctrl-c```

Unfortunately, when using custom colors one cannot set just an individual key, the minimum is an entire row. And if you only set a row, the rest of the keyboard remains black. So in this example besides the wheel color being updated, the rest of the keyboard keys colors are set to random values.

## Example 2: Load a PNG file

This example needs a dependency library to load PNG files, so run ```npm install``` first.

Change the device filename string to match your device as in the first example.

The example loads a PNG image on the keyboard LEDs, by default 22x9 pixels. To change to your keyboards dimensions, set ```keyb.numRows``` and ```keyb.numColums``` just after the contruction of the RazerKeyboard (line ```const keyb = new RazerKeyboard();``` ). To change the PNG image filename being loaded, change the line ```const imagePath = './yombo.png';```

The example loads the color on the keyboard and then just exits.

## Example 3: Audio equalizer

This example gets the system audio volume output and shows a bar in the hand rest LEDs depending on audio volume.

You need the program ```arecord``` intalled to use this. Also you'll need to set the keyboard device as in the other examples.

## Lib

The file ```lib/RazerKeyboard.js``` is a class lib used in all the examples. It contains methods to set all the effect modes.

