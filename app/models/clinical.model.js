module.exports = mongoose => {
  var schema = mongoose.Schema({
    aic: {
      type: Number,
    },
    firstName: {
      type: String,
      required: true,
      default: ''
    },
    lastName: {
      type: String,
      default: '',
    },
    userRole: {
      type: String
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      default: ''
    },
    title: {
      type: String,
      default: ''
    },
    birthday: {
      type: String,
    },
    socialSecurityNumber: {
      type: String,
      default: ''
    },
    verifiedSocialSecurityNumber: {
      type: String,
      default: ''
    },
    address: {
      streetAddress: {
        type: String,
        default: ''
      },
      streetAddress2: {
        type: String,
        default: ''
      },
      city: {
        type: String,
        default: ''
      },
      state: {
        type: String,
        default: ''
      },
      zip: {
        type: String,
        default: ''
      }
    },
    photoImage: {
      type: { type: String, default: '' },
      content: { type: Buffer, default: '' },
      name: { type: String, default: '' }
    },
    password: {
      type: String,
      required: true,
      default: ''
    },
    clinicalAcknowledgeTerm: {
      type: Boolean,
      default: false
    },
    signature: {
      type: Buffer,
      require: true,
      default: '',
    },
    logined: {
      type: Boolean,
      default: false,
    },
    entryDate: {
      type: String
    },
    driverLicense: {
      type: { type: String, default: '' },
      content: { type: Buffer, default: '' },
      name: { type: String, default: '' }
    },
    socialCard: {
      type: { type: String, default: '' },
      content: { type: Buffer, default: '' },
      name: { type: String, default: '' }
    },
    physicalExam: {
      type: { type: String, default: '' },
      content: { type: Buffer, default: '' },
      name: { type: String, default: '' }
    },
    ppd: {
      type: { type: String, default: '' },
      content: { type: Buffer, default: '' },
      name: { type: String, default: '' }
    },
    mmr: {
      type: { type: String, default: '' },
      content: { type: Buffer, default: '' },
      name: { type: String, default: '' }
    },
    healthcareLicense: {
      type: { type: String, default: '' },
      content: { type: Buffer, default: '' },
      name: { type: String, default: '' }
    },
    resume: {
      type: { type: String, default: '' },
      content: { type: Buffer, default: '' },
      name: { type: String, default: '' }
    },
    covidCard: {
      type: { type: String, default: '' },
      content: { type: Buffer, default: '' },
      name: { type: String, default: '' }
    },
    bls: {
      type: { type: String, default: '' },
      content: { type: Buffer, default: '' },
      name: { type: String, default: '' }
    },
    userStatus: {
      type: String,
      default: 'inactive'
    },
    device: [{
      type: String
    }],
    verifyCode: {
      type: String,
      default: ''
    },
    verifyTime: {
      type: Number,
      default: 0
    },
    verifyPhoneCode: {
      type: String,
      default: ''
    },
    verifyPhoneTime: {
      type: Number,
      default: 0
    }
  });

  schema.method("toJSON", function () {
    const { _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });


  const Clinical = mongoose.model("Clinical", schema); // Changed model name to "Master"
  return Clinical;
};