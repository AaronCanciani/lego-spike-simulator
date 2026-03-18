Welcome to the lego-spike-simulator project. The aim is to provide
an environment where LEGO spike robots can be simulated and the
code tested before uploading to a real LEGO spike robot.

The environment currently only supports the blockly based programming
language.

The simulator allows lego format llsp3 programs to be loaded and saved,
and can load robots in the ldraw format (ldr and mpd extensions).
Port connectivity can be specified, and saved into a robot to be loaded
again at a later time. A basic scene can be setup using images for a base
map and ldraw objects for obstacles in the scene.

There is very limited physics at the moment, focussed on moving a
wheel base with a specific gearing.

The system is currently available at http://spike.ahardy.za.net/.
However, the system can be built locally and executed directly
from files, so no webserver is required. The software can run completely
from the web browser.

# Screenshots

![Start screen](./website/start.png)

![Code loaded](./website/code.png)

![Preparing to open a robot](./website/open_robot.png)

![Robot view](./website/robot_view.png)

![Port connector](./website/port_connector.png)

![Opening a scene](./website/load_scene.png)

![Running simulator](./website/running.png)

# Robots

[Driving base 3](http://ahfiles.s3-website.us-east-1.amazonaws.com/robots/DrivingBase3.mpd)

# Scenes

[WRO In house 2025 Level 1](http://ahfiles.s3-website.us-east-1.amazonaws.com/scenes/WRO-InHouse-Level1.spk)
