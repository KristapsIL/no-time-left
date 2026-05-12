Instalācija

1. Klonē repo:
   git clone https://github.com/quakez/no-time-left.git
   cd no-time-left

2. Instalē dependencies:
   composer install
   npm install

3. Konfigurē .env:
   - Kopē .env.example uz .env
   - Iestati datubāzi (MySQL)
   - Iestati Pusher credentials (ja lieto Pusher):
     BROADCAST_CONNECTION=pusher
     PUSHER_APP_KEY=your_key
     PUSHER_APP_SECRET=your_secret
     PUSHER_APP_ID=your_id
     PUSHER_APP_CLUSTER=your_cluster

4. Migrācijas un seeders:
   php artisan migrate
   php artisan db:seed

Palaist

1. Start server:
   php artisan serve

2. Start frontend (dev mode):
   npm run dev

3. Palaid arī queue worker reāllaika broadcastam:
   php artisan queue:work

4. Atver pārlūkprogrammā: http://localhost:8000
