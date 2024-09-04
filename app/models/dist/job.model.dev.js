"use strict";

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

module.exports = function (mongoose) {
  var schema = mongoose.Schema({
    jobId: {
      type: Number,
      required: true,
      unique: true
    },
    countBDA: {
      type: String,
      "default": "BDA"
    },
    entryDate: {
      type: Date,
      "default": new Date()
    },
    bid: {
      type: String,
      "default": ''
    },
    account: {
      type: String,
      "default": ''
    },
    nurse: {
      type: String,
      "default": ''
    },
    facility: {
      type: String,
      "default": '',
      required: true
    },
    bid_offer: {
      type: Number,
      "default": 0
    },
    jobStatus: {
      type: String,
      "default": 'Available',
      required: true
    },
    jobInfo: {
      type: String,
      "default": ''
    },
    jobNum: {
      type: Number,
      "default": true
    },
    degree: {
      type: String,
      "default": ''
    },
    unit: {
      type: String,
      "default": ""
    },
    location: {
      type: String,
      "default": ''
    },
    address: {
      street: {
        type: String,
        "default": ''
      },
      street2: {
        type: String,
        "default": ''
      },
      city: {
        type: String,
        "default": ''
      },
      state: {
        type: String,
        "default": ''
      },
      zip: {
        type: String,
        "default": ''
      }
    },
    locationName: {
      type: String,
      "default": ''
    },
    shift: {
      type: String,
      "default": ''
    },
    shiftDateAndTimes: {
      dateFrom: {
        type: String,
        "default": ''
      },
      timeFrom: {
        type: String,
        "default": ''
      },
      dateTo: {
        type: String,
        "default": ''
      },
      timeTo: {
        type: String,
        "default": ''
      }
    },
    timeSheet: {
      type: String,
      "default": ''
    },
    jobRating: {
      type: Number,
      "default": 0
    },
    payRate: {
      type: String,
      "default": ''
    },
    timeSheetTemplate: {
      type: String,
      "default": 0
    },
    timeSheetVerified: {
      type: Boolean,
      "default": false
    },
    bonus: {
      type: String,
      "default": ''
    },
    hours: {
      type: Number,
      "default": 0
    },
    hoursDateAndTime: {
      type: String,
      "default": ''
    },
    hoursTimer: {
      type: String,
      "default": ''
    },
    hoursComments: {
      type: String,
      "default": ''
    },
    isHoursSubmit: {
      type: String,
      "default": ''
    },
    isHoursApproved: {
      type: String,
      "default": ''
    },
    preTime: {
      type: String,
      "default": ''
    },
    lunch: {
      type: String,
      "default": ''
    },
    finalHours: {
      type: Number,
      "default": 0
    },
    lunchEquation: {
      type: Number,
      "default": 0
    },
    finalHoursEquation: {
      type: Number,
      "default": 0
    },
    caregiver: {
      type: String,
      "default": 0
    },
    shiftTime: {
      type: String,
      "default": ''
    },
    shiftDate: {
      type: Date,
      "default": new Date()
    }
  });
  schema.method("toJSON", function () {
    var _this$toObject = this.toObject(),
        _id = _this$toObject._id,
        object = _objectWithoutProperties(_this$toObject, ["_id"]);

    object.id = _id;
    return object;
  });
  var Jobs = mongoose.model("Jobs", schema); // Changed model name to "Master"

  return Jobs;
};
//# sourceMappingURL=job.model.dev.js.map
