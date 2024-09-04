"use strict";

function _objectWithoutProperties(source, excluded) { if (source == null) return {}; var target = _objectWithoutPropertiesLoose(source, excluded); var key, i; if (Object.getOwnPropertySymbols) { var sourceSymbolKeys = Object.getOwnPropertySymbols(source); for (i = 0; i < sourceSymbolKeys.length; i++) { key = sourceSymbolKeys[i]; if (excluded.indexOf(key) >= 0) continue; if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue; target[key] = source[key]; } } return target; }

function _objectWithoutPropertiesLoose(source, excluded) { if (source == null) return {}; var target = {}; var sourceKeys = Object.keys(source); var key, i; for (i = 0; i < sourceKeys.length; i++) { key = sourceKeys[i]; if (excluded.indexOf(key) >= 0) continue; target[key] = source[key]; } return target; }

module.exports = function (mongoose) {
  var schema = mongoose.Schema({
    userStatus: {
      type: Boolean,
      "default": false
    },
    userRole: {
      type: String,
      "default": '' // required:true,

    },
    entryDate: {
      type: Date,
      "default": Date.now
    },
    companyName: {
      type: String,
      "default": ''
    },
    firstName: {
      type: String,
      required: true
    },
    lastName: {
      type: String,
      required: true
    },
    contactEmail: {
      type: String,
      required: true
    },
    contactPhone: {
      type: Number,
      required: true
    },
    password: {
      type: String,
      required: true
    },
    contactPassword: {
      type: String,
      "default": ''
    },
    facilityAcknowledgeTerm: {
      type: Boolean,
      "default": false
    },
    signature: {
      type: String,
      "default": ''
    },
    address: {
      street: {
        type: String,
        required: true,
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
    avatar: {
      content: {
        type: String,
        "default": ''
      },
      type: {
        type: String,
        "default": ''
      },
      name: {
        type: String,
        "default": ''
      }
    }
  });
  schema.method("toJSON", function () {
    var _this$toObject = this.toObject(),
        __v = _this$toObject.__v,
        _id = _this$toObject._id,
        object = _objectWithoutProperties(_this$toObject, ["__v", "_id"]);

    object.id = _id;
    return object;
  });
  var Facility = mongoose.model("Facility", schema);
  return Facility;
};
//# sourceMappingURL=facilities.model.dev.js.map
