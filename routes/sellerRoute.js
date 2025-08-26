import express from 'express';
import { register, login, forgetPassword, getAllResponses } from '../controllers/sellerController.js';

const sellerRouter = express.Router();

sellerRouter.post('/register', register);
sellerRouter.post('/login', login);
sellerRouter.post('/getallresponses', getAllResponses);
sellerRouter.post('/forget-password', forgetPassword);


export default sellerRouter;
