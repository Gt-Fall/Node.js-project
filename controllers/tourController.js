const Tour = require('./../models/tourModel');
const APIFeatures = require('./../utils/apiFeatures');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/AppError');


exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};


exports.getAllTours = catchAsync( async (req, res, next) => {
    //EXECUTE QUERY
    const features = new APIFeatures(Tour.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();
    const tours = await features.query;

    //SEND QUERY
    res.status(200).json({
    status: 'sucess',
    results: tours.length,
    data: {
      tours,
    },
  });
 
});

exports.getTour = catchAsync(async (req, res, next) => {
    const tour = await Tour.findById(req.params.id);
    // Tour.findOne({ _id: req.prams.id});

    if(!tour) {
      return next(new AppError('No tour found with that ID', 404));
    };

    res.status(200).json({
      status: 'sucess',
      data: {
        tour,
      },
    });
});


exports.createTour = catchAsync(async (req, res,next) => {
  const newTour = await Tour.create(req.body);

  res.status(201).json({
    status: 'sucess',
    data: {
      tour: newTour
    }
  });
});
  

exports.updateTour = catchAsync(async (req, res, next) => {
    const tour = await Tour.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })

    if(!tour) {
      return next(new AppError('No tour found with that ID', 404));
    };

    res.status(200).json({
      stutus: 'sucess',
      data: {
       tour,
     },
    });
});

exports.deleteTour = catchAsync(async (req, res, next) => {
    const tour = await Tour.findByIdAndDelete(req.params.id);

    if(!tour) {
      return next(new AppError('No tour found with that ID', 404));
    };

    res.status(204).json({
      stutus: 'sucess',
      data: null,
    }); 
});

exports.getTourStats = catchAsync (async (req, res, next) => {
    const stats = await Tour.aggregate([
      {
        $match:{ratingsAverage : {$gte: 4.5}}
      },
      {
        $group: {
           _id: {$toUpper : '$difficulty'},
          numTours: {$sum: 1},
          numRatings: {$sum: '$ratingsQuantity'},
          avgRating: {$avg: '$ratingsAverage'},
          avgPrice: { $avg: '$price'},
          minPrice: { $min: "$price"},
          maxPrice: { $max: "$price"}
          }
      },
      {
        $sort: { avgPrice: 1}
      }
      // {
      //  $match: {_id: {$ne: 'EASY'}} 
      // }
    ]);
    res.status(200).json({
      stutus: 'sucess',
      data: {
       stats,
     },
    });
});

exports.getMonthyPlan = catchAsync( async (req,res, next) => {
    const year = req.params.year * 1;
    const plan = await Tour.aggregate([
      {
        $unwind: '$startDates'
      },
      {
        $match: {
          startDates: {
            $gte: new Date(`${year}-01-01`),
            $lte: new Date(`${year}-12-31`),
          }
        }
      },
      {
        $group: {
          _id: {$month: '$startDates'},
          numTourStarts: {$sum: 1},
          tours: {$push: '$name'}
        }
      },
      {
        $addFields: {month: '$_id'}
      },
      {
        $project: {
          _id: 0
        }
      },
      {
        $sort: {numTourStarts: -1}
      },
      {
        $limit: 12
      }
    ]);

    res.status(200).json({
      stutus: 'sucess',
      data: {
       plan
     },
    });    
});


// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`)
// ); ////used to read the Json file before reading from the database 

// exports.checkID = (req, res, next, val) => {
//   if (req.params.id * 1 > tours.length) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID',
//     });
//   }
//   next();
// };  //Middleware not needed anymore as will be used in 

// exports.checkBody = (req, res, next) => {
//   if (!req.body.name || !req.body.price) {
//     return res.status(400).json({
//       status: 'fail',
//       message: 'Missing name or price',
//     });
//   }
//   next();
// }; // Middle ware for checking body 




    // const tours = await Tour.find().where('duration').equals(5).where('difficulty').equals('easy');