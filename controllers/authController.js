const {promisify} = require('util');
const crypto = require('crypto');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const jwt = require('jsonwebtoken');
const AppError = require('./../utils/appError');
const sendEmail = require('./../utils/email');



const signToken = id => {
    return jwt.sign({id}, process.env.JWT_SECRET,{
        expiresIn: process.env.JWT_EXPIRES_IN
    });
}

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);

    res.status(statusCode).json({
        status : 'sucess',
        token,
        data : {
            user
        }
    });
}

exports.signup = catchAsync(async (req, res, next) => {
    
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email, 
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
        passwordChangedAt: req.body.passwordChangedAt,
        role: req.body.role,
        passwordResetToken: req.body.passwordResetToken,
        passwordResetExpires: req.body.passwordResetExpires
    });
    createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req,res,next) => {
    const {email, password} = req.body;

    //1)Check email and password exist
    if(!email || !password) {
        return next(new AppError('Please Provide email and password!', 400));
    }
    //2) Check if user exists && password is correct
    const user = await User.findOne({email}).select('+password');

    if(!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }
    // 3) if everything is ok, send token to clinet
    createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
    //1) Getting tocken and check if its exists
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
    ) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return next(new AppError('You are not logged in. Login to get access', 401));
    }
    //2) verification of token 
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    
    //3) check if user still exists  
    const currentUser = await User.findById(decoded.id); 
    if (!currentUser) {
        return next(new AppError('The user belonging to the token no longer exisits', 401))
    }
    //4) Check if user changed password after token was issued
    if(currentUser.changedPasswordAfter(decoded.iat)) {
        return next(
            new AppError('User Recently changed password. Please login again.',401)
        );
    };

    //Grants Access to Protected Route 
    req.user = currentUser;
    next();
}); 

exports.restrictTo = (...roles) => {
    return (req,res,next) => {
    //roles is an array ['admin', 'lead-guide']. role = 'user' 
        if(!roles.includes(req.user.role)) {
            return next(new AppError('You do not have premisson to perform this action', 403)
            );
        }
        next();
    };
};

exports.forgotPassword = catchAsync(async (req,res,next) => {
    //1) Get user based on POSTed Email
    const user = await User.findOne({email: req.body.email });
    if (!user) {
        return next(new AppError("there is no user with that email address",404))
    }
    //2) Generate a random token 
    const resetToken = user.createPasswordResetToken();
    await user.save({validateBeforeSave: false});


    //3) Send back as email
    const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;

    const message = `Forgot your Password? Submit an PATCH request with our new Password and PasswordConform to: ${resetURL}. \n If you didn't forget your password please ignore this email!`;
    try {
    await sendEmail({
        email: user.email,
        subject: 'Your Password Reset token(Valid for 10 mins)',
        message
    });

    res.status(200).json({
        status: 'success',
        message: 'Token Sent to email!'
    });
}catch(err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({validateBeforeSave: false});

    return next(new AppError('there was an error sending the email. Try again later',500));
}
});

exports.resetPassword = catchAsync(async(req,res,next) => {
    //1) get user based on token
    const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken, 
        passwordResetExpires: {$gt:Date.now()}
    });

    //2) Set new password if token has not expired and there is a user
    if(!user) {
        return next(new AppError('Token is invalid or expired',400))
    };

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    //3) Update changedPasswordAt property for the user


    //4) Log the user in
    createSendToken(user, 200, res);
    

});

exports.updatePassword = catchAsync(async(req,res,next) => {
    //1) Get user from collection
    const user = await User.findById(req.user.id).select('+password');

    //2) check if POSTed current password is correct
    if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
        return next(new AppError('Your current password is worng.', 401))
    }

    //3) if so, update password 
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();
    //User.findByIdAndUpdate will NOT work as intended here. must be user.save() 

    //4) Log user in, send JWT 
    createSendToken(user, 200, res);
});