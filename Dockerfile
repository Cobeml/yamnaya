FROM ubuntu:22.04

# Avoid interactive prompts during apt installations
ENV DEBIAN_FRONTEND=noninteractive

# Install essential tools, desktop environment (Xfce4), Virtual Framebuffer (Xvfb), and VNC
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    sudo \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    dbus-x11 \
    xfce4 \
    xfce4-terminal \
    xvfb \
    x11vnc \
    novnc \
    websockify \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user 'openclaw'
RUN useradd -m -s /bin/bash openclaw \
    && echo "openclaw ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Set up the VNC and window manager configuration
RUN mkdir -p /home/openclaw/.vnc \
    && echo "x11vnc -display :99 -nopw -forever -shared &" > /home/openclaw/.vnc/xstartup \
    && echo "startxfce4 &" >> /home/openclaw/.vnc/xstartup \
    && chmod +x /home/openclaw/.vnc/xstartup

# Configure supervisord to run Xvfb, the window manager, and VNC
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Set environment variables for the display
ENV DISPLAY=:99
ENV RESOLUTION=1280x800x24

# Set working directory to the user's home
WORKDIR /home/openclaw/workspace

# Change ownership of the home directory
RUN chown -R openclaw:openclaw /home/openclaw

# Switch to the non-root user
USER openclaw

# Expose VNC port
EXPOSE 5900

# Start supervisor which will manage the background GUI processes
CMD ["sudo", "/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
