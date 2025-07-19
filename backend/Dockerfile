# Stage 1: Build islands components
FROM node:21-alpine AS islands-builder

# Set working directory to match the structure in the repo
# This is important because the Vite config uses relative paths
WORKDIR /app/src

# First, create the directory structure
RUN mkdir -p /app/src/board/templates/islands

# Copy the entire templates directory to ensure all referenced styles are available
COPY ./src/board/templates /app/src/board/templates

# Set working directory to islands directory
WORKDIR /app/src/board/templates/islands

# Install dependencies
RUN npm install

# Build islands components
# The output will go to ../../../static/islands as configured in vite.config.ts
RUN npm run build

# Stage 2: Build backend
FROM baealex/blex-backend-base

COPY ./src/requirements.txt /app/

WORKDIR /app
RUN pip install -r requirements.txt --use-pep517

# Copy backend source
COPY ./src /app

# Copy built islands assets from the first stage
# The build output is in /app/src/static/islands from the first stage
COPY --from=islands-builder /app/src/static/islands/ /app/static/islands/

# Set environment variable for static files
ENV STATIC_URL=/static/
# Run collectstatic to gather all static files
RUN python manage.py collectstatic --noinput

ENTRYPOINT ["uwsgi"]
CMD ["--socket", ":9000", "--module", "main.wsgi", "-b", "32768", "--max-requests", "5000", "--master", "--harakiri", "120", "--vacuum", "--die-on-term", "--no-orphans", "--single-interpreter", "--enable-threads", "--threads", "2"]
