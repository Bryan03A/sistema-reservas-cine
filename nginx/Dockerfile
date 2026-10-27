FROM nginx:alpine
RUN apk add --no-cache openssl
COPY default.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
# por si Git en Windows convirtió los saltos de línea a CRLF
RUN sed -i 's/\r$//' /entrypoint.sh /etc/nginx/conf.d/default.conf && chmod +x /entrypoint.sh
EXPOSE 80 443
ENTRYPOINT ["/entrypoint.sh"]
