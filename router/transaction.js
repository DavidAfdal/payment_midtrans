import express from 'express';
import { CreateTranslation, WebHookMidtrans } from '../controller/transaction.js';


const router = express.Router();

router.post('/payment', CreateTranslation);
router.post('/webhook', WebHookMidtrans);



export default router