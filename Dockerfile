# Use the official, ultra-lightweight Nginx image
FROM nginx:alpine

# Remove the default Nginx configuration file
RUN rm /etc/nginx/conf.d/default.conf

# Copy our custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy all project files (HTML, CSS, JS, Images) to the Nginx public directory
COPY . /usr/share/nginx/html

# Hugging Face Spaces requires the app to listen on port 7860
EXPOSE 7860

# Start Nginx in the foreground (Required for Docker containers)
CMD ["nginx", "-g", "daemon off;"]
