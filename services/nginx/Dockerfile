FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
RUN mkdir -p /var/www/app/static && \
    echo "public asset" > /var/www/app/static/logo.txt && \
    mkdir -p /var/www/app/secrets && \
    echo "FLAG{ng1nx_4l1as_path_trav}" > /var/www/app/secrets/flag.txt