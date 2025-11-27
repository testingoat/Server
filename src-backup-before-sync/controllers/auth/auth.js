import {Customer,DeliveryPartner} from '../../models/user.js';
import jwt from 'jsonwebtoken';

const generateTokens = (user)=>{
    // 🐛 DEBUG: Check if JWT secrets are loaded
    console.log('🔍 DEBUG - JWT Environment Variables:');
    console.log('ACCESS_TOKEN_SECRET exists:', !!process.env.ACCESS_TOKEN_SECRET);
    console.log('ACCESS_TOKEN_SECRET length:', process.env.ACCESS_TOKEN_SECRET?.length);
    console.log('REFRESH_TOKEN_SECRET exists:', !!process.env.REFRESH_TOKEN_SECRET);
    console.log('REFRESH_TOKEN_SECRET length:', process.env.REFRESH_TOKEN_SECRET?.length);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('All env keys containing TOKEN:', Object.keys(process.env).filter(key => key.includes('TOKEN')));
    
    if (!process.env.ACCESS_TOKEN_SECRET) {
        console.error('❌ CRITICAL: ACCESS_TOKEN_SECRET is undefined!');
        throw new Error('ACCESS_TOKEN_SECRET environment variable is missing');
    }
    
    const accessToken = jwt.sign(
        {userId : user._id,role:user.role},
        process.env.ACCESS_TOKEN_SECRET,
        {expiresIn:'1d'}
    );

    const refreshToken = jwt.sign(
        {userId : user._id,role:user.role},
        process.env.REFRESH_TOKEN_SECRET,
        {expiresIn:'7d'}
    );
    return {accessToken,refreshToken};
};

export const loginCustomer = async (req,reply)=>{
  try {
     const {phone} = req.body;
     let customer = await Customer.findOne({phone});

     if(!customer){
        customer = new Customer({
            phone,
            role:'Customer',
            isActivated:true,
        });
        await customer.save();
     }

     const  {accessToken,refreshToken } = generateTokens(customer);

     return reply.send({
        message: 'Login Successful',
        accessToken,
        refreshToken,
        customer,
     });
  } catch (error) {
    return reply.status(500).send({ message: 'An error occurred', error });
  }
};

export const loginDeliveryPartner = async (req, reply) => {
    try {
      const { email, password } = req.body;
      console.log('Delivery login attempt with email:', email);
      const deliveryPartner = await DeliveryPartner.findOne({ email });
      console.log('Found delivery partner:', deliveryPartner);

      if (!deliveryPartner) {
        console.log('Delivery Partner not found for email:', email);
        return reply.status(404).send({
          message: 'Delivery Partner Not Registered! Please Contact Admin!',
          error: 'NOT_REGISTERED',
        });
      }

      const isMatch = password === deliveryPartner.password;

      if (!isMatch) {
        return reply.status(400).send({
          message: 'Invalid Credentials',
          error: 'INVALID_CREDENTIALS',
        });
      }

      const { accessToken, refreshToken } = generateTokens(deliveryPartner);

      return reply.send({
        message: 'Login Successful',
        accessToken,
        refreshToken,
        deliveryPartner,
      });
    } catch (error) {
      console.log('Delivery login error:', error);
      return reply.status(500).send({
        message: 'An error occurred during login',
        error: 'SERVER_ERROR',
      });
    }
  };

export const refreshToken = async(req,reply)=>{
    const {refreshToken: clientRefreshToken} = req.body;
    console.log('Refresh token attempt with token:', clientRefreshToken ? 'Token provided' : 'No token');

    if(!clientRefreshToken){
        return reply.status(401).send({ message: 'Refresh token required' });
    }

    try {
        const decoded = jwt.verify(clientRefreshToken, process.env.REFRESH_TOKEN_SECRET);
        console.log('Decoded refresh token:', decoded);
        let user;

          if (decoded.role === 'Customer') {
            user = await Customer.findById(decoded.userId);
          } else if (decoded.role === 'DeliveryPartner') {
            user = await DeliveryPartner.findById(decoded.userId);
          } else {
            return reply.status(403).send({ message: 'Invalid Role' });
          }

          if (!user) {
            return reply.status(403).send({ message: 'User not found' });
          }

         const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

         return reply.send({
            message: 'Token Refreshed',
            accessToken,
            refreshToken: newRefreshToken,
          });

    } catch (error) {
        console.log('Refresh token error:', error);
        return reply.status(403).send({ message: 'Invalid Refresh Token' });
    }

};

export const fetchUser = async (req,reply)=>{
    try {
        const { userId, role } = req.user;
        let user;

        if (role === 'Customer') {
          user = await Customer.findById(userId);
        } else if (role === 'DeliveryPartner') {
          user = await DeliveryPartner.findById(userId);
        } else {
          return reply.status(403).send({ message: 'Invalid Role' });
        }

        if (!user) {
          return reply.status(404).send({ message: 'User not found' });
        }

        return reply.send({
          message: 'User fetched successfully',
          user,
        });
      } catch (error) {
        return reply.status(500).send({ message: 'An error occurred', error });
      }
};
