const AppError = require("./../utils/appError");

const handleCastErrorDB = err => {
    const message = `Invalid ${err.path} : ${err.value}.`
    return new AppError(message, 400);
};

const handleDuplicateFeildsDB = () => {
    const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
    const message = `Duplicate field value : ${value} Please use another value`;
    return new AppError(message, 400);
};

const handleValidationErrorDB = () => {
    const errors = Object.values(err.errors).map(el => el.message);
    
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
}

const handleJWTError = err => new AppError('Invalid Token. Please Log in again', 401);

const handleJWTExpiredError = err => new AppError('Your token has Expired. Please Log in again', 401);

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

const sendErrorProd = (err, res) => {
    //operational, trusted error : semd message to cilet
    if(err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    //Programming or other unknown error, dont leak error details.     
    } else {
        // log error
        console.error('Error💥 ', err);
        // send generic error
        res.status(500).json({
            status:'error',
            message: 'Something went very wrong'
        });
    }
};

module.exports = (err,req,res,next) => {
    
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    
    if(process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
     }else if (process.env.NODE_ENV === 'production') {
        //let error = { ...err, name: err.name };
        let error = Object.assign(err);

        if (error.name === 'CastError') error = handleCastErrorDB(error);
        if (error.code === 11000) error = handleDuplicateFeildsDB(error);
        if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
        if (error.name === 'JsonWebTokenError') error = handleJWTError();
        if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
        sendErrorProd(error, res);

    }
 };  