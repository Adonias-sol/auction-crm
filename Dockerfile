FROM python:3.12-slim

# Install system dependencies for WeasyPrint
RUN apt-get update && apt-get install -y \
    libpango-1.0-0 \
    libpango-1.0-dev \
    libpangoft2-1.0-0 \
    libcairo2 \
    libcairo2-dev \
    libgobject-2.0-0 \
    libgobject-2.0-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

CMD ["gunicorn", "auction_crm.wsgi:application", "--bind", "0.0.0.0:10000"]