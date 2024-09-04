"use strict";

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

module.exports = function (mongoose) {
  var schema = mongoose.Schema({
    firstName: {
      type: String,
      required: true,
      "default": ''
    },
    lastName: {
      type: String,
      "default": ''
    },
    userRole: {
      type: String
    },
    email: {
      type: String,
      required: true // unique: true,

    },
    phoneNumber: {
      type: String,
      required: true,
      "default": ''
    },
    title: {
      type: String,
      required: true,
      "default": ''
    },
    birthday: {
      type: String,
      required: true
    },
    socialSecurityNumber: {
      type: String,
      required: true,
      "default": ''
    },
    verifiedSocialSecurityNumber: {
      type: String,
      required: true,
      "default": ''
    },
    address: {
      streetAddress: {
        type: String,
        required: true,
        "default": ''
      },
      streetAddress2: {
        type: String,
        "default": ''
      },
      city: {
        type: String,
        required: true,
        "default": ''
      },
      state: {
        type: String,
        required: true,
        "default": ''
      },
      zip: {
        type: String,
        required: true,
        "default": ''
      }
    },
    photoImage: {
      type: {
        type: String,
        "default": ''
      },
      content: {
        type: String,
        "default": ''
      }
    },
    password: {
      type: String,
      required: true,
      "default": ''
    },
    signature: {
      type: String,
      require: true,
      "default": ''
    },
    logined: {
      type: Boolean,
      "default": false
    },
    entryDate: {
      type: String
    },
    driverLicense: {
      type: {
        type: String,
        "default": ''
      },
      content: {
        type: String,
        "default": ''
      }
    },
    socialCard: {
      type: {
        type: String,
        "default": ''
      },
      content: {
        type: String,
        "default": ''
      }
    },
    physicalExam: {
      type: {
        type: String,
        "default": ''
      },
      content: {
        type: String,
        "default": ''
      }
    },
    ppd: {
      type: {
        type: String,
        "default": ''
      },
      content: {
        type: String,
        "default": ''
      }
    },
    mmr: {
      type: {
        type: String,
        "default": ''
      },
      content: {
        type: String,
        "default": ''
      }
    },
    healthcareLicense: {
      type: {
        type: String,
        "default": ''
      },
      content: {
        type: String,
        "default": ''
      }
    },
    resume: {
      type: {
        type: String,
        "default": ''
      },
      content: {
        type: String,
        "default": ''
      }
    },
    covidCard: {
      type: {
        type: String,
        "default": ''
      },
      content: {
        type: String,
        "default": ''
      }
    },
    bls: {
      type: {
        type: String,
        "default": ''
      },
      content: {
        type: String,
        "default": ''
      }
    }
  });
  schema.method("toJSON", function () {
    var _this$toObject = this.toObject(),
        _id = _this$toObject._id,
        object = _objectWithoutProperties(_this$toObject, ["_id"]);

    object.id = _id;
    return object;
  });
  var Clinical = mongoose.model("Clinical", schema); // Changed model name to "Master"

  return Clinical;
};
//# sourceMappingURL=clinical.model.dev.js.map
