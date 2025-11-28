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
      content: { type: String, default: '' },
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
    clinicalTermsVersion: {
      type: String,
      default: ''
    },
    clinicalTermsSignedDate: {
      type: Date,
      default: null
    },
    signature: {
      type: Buffer,
      required: false,
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
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    driverLicenseStatus: {
      type: Boolean,
      default: false
    },
    socialCard: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    socialCardStatus: {
      type: Boolean,
      default: false
    },
    physicalExam: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    physicalExamStatus: {
      type: Boolean,
      default: false
    },
    ppd: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    ppdStatus: {
      type: Boolean,
      default: false
    },
    mmr: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    mmrStatus: {
      type: Boolean,
      default: false
    },
    healthcareLicense: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    healthcareLicenseStatus: {
      type: Boolean,
      default: false
    },
    resume: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    resumeStatus: {
      type: Boolean,
      default: false
    },
    covidCard: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    covidCardStatus: {
      type: Boolean,
      default: false
    },
    bls: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    blsStatus: {
      type: Boolean,
      default: false
    },
    hepB: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    hepBStatus: {
      type: Boolean,
      default: false
    },
    flu: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    fluStatus: {
      type: Boolean,
      default: false
    },
    cna: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    cnaStatus: {
      type: Boolean,
      default: false
    },
    taxForm: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    taxFormStatus: {
      type: Boolean,
      default: false
    },
    chrc102: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    chrc102Status: {
      type: Boolean,
      default: false
    },
    chrc103: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    chrc103Status: {
      type: Boolean,
      default: false
    },
    drug: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    drugStatus: {
      type: Boolean,
      default: false
    },
    ssc: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    sscStatus: {
      type: Boolean,
      default: false
    },
    copyOfTB: {
      type: { type: String, default: '' },
      content: { type: String, default: '' },
      name: { type: String, default: '' }
    },
    copyOfTBStatus: {
      type: Boolean,
      default: false
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
    },
    fcmToken: {
      type: String,
      default: ''
    },
    assignedShift: {
      type: Array,
      default: []
    }
  });

  schema.method("toJSON", function () {
    const { _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });

  schema.index({ aic: 1, email: 1 });

  const Clinical = mongoose.model("Clinical", schema); // Changed model name to "Master"
  return Clinical;
};