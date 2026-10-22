#!/usr/bin/env bash
# Start the tool on the robot PC with ROS 2 and the ethercat workspace sourced.
# Usage: ./start-robot.sh [path/to/workspace/install/setup.bash]
#   or set WORKSPACE_SETUP / ROS_SETUP in the environment.
set -e
cd "$(dirname "$0")"

ROS_SETUP="${ROS_SETUP:-/opt/ros/humble/setup.bash}"
WORKSPACE_SETUP="${1:-${WORKSPACE_SETUP:-}}"
if [ -z "$WORKSPACE_SETUP" ]; then
  for f in "$HOME"/ros2_ws/install/setup.bash "$HOME"/*_ws/install/setup.bash; do
    if [ -f "$f" ]; then WORKSPACE_SETUP="$f"; break; fi
  done
fi

[ -f "$ROS_SETUP" ] || { echo "ROS setup not found: $ROS_SETUP (set ROS_SETUP=...)"; exit 1; }
# shellcheck disable=SC1090
source "$ROS_SETUP"
if [ -n "$WORKSPACE_SETUP" ]; then
  [ -f "$WORKSPACE_SETUP" ] || { echo "Workspace setup not found: $WORKSPACE_SETUP"; exit 1; }
  # shellcheck disable=SC1090
  source "$WORKSPACE_SETUP"
  echo "Sourced $ROS_SETUP and $WORKSPACE_SETUP"
else
  echo "Sourced $ROS_SETUP (no workspace found; pass its install/setup.bash as the first argument if ethercat_msgs lives there)"
fi
export WORKSPACE_SETUP

if [ ! -d node_modules/rclnodejs ]; then
  echo "Installing dependencies (rclnodejs builds against the ROS 2 just sourced)..."
  npm install
fi
[ -f client/dist/index.html ] || npm run build

exec node server/launcher.js
