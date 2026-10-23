   import { connectDatabase } from '../src/config/db.js';
   import { prepareApp } from '../src/app.js';

   let appPromise;
   function getApp() {
     if (!appPromise) {
       appPromise = (async () => {
         await connectDatabase();
         return prepareApp();
       })();
     }
     return appPromise;
   }

   export default async function handler(req, res) {
     const app = await getApp();
     return app(req, res);
   }