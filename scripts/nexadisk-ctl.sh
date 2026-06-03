#!/bin/bash

# NexaDisk Professional: Service Control Utility
# usage: ./nexadisk-ctl.sh [start|stop|restart|status|logs]

CMD=$1
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

case $CMD in
    start)
        echo -e "${GREEN}Starting NexaDisk Services...${NC}"
        cd "$PROJECT_ROOT/server" && pm2 start index.js --name nexadisk
        ;;
    stop)
        echo -e "${YELLOW}Stopping NexaDisk Services...${NC}"
        pm2 stop nexadisk
        ;;
    restart)
        echo -e "${CYAN}Restarting NexaDisk Services...${NC}"
        pm2 restart nexadisk --update-env
        ;;
    status)
        pm2 status nexadisk
        ;;
    logs)
        pm2 logs nexadisk
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac
