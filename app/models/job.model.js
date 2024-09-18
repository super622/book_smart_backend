const { defaultAbiCoder } = require("ethers/lib/utils");

module.exports = mongoose => {
  var schema = mongoose.Schema({
    jobId: {
      type: Number,
      required: true,
      unique: true
    },
    countBDA: {
      type: String,
      default: "BDA"
    },
    entryDate: {
      type: String,
      default: ''
    },
    bid: {
      type: String,
      default: ''
    },
    account: {
      type: String,
      default: ''
    },
    nurse: {
      type: String,
      default: ''
    },
    facility: {
      type: String,
      default: '',
      required: true,
    },
    bid_offer: {
      type: Number,
      default: 0
    },
    jobStatus: {
      type: String,
      default: 'Available',
      required: true
    },
    jobInfo: {
      type: String,
      default: ''
    },
    jobNum: {
      type: Number,
      default: true,
    },
    degree: {
      type: String,
      default: '',
    },
    unit: {
      type: String,
      default: ""
    },
    location: {
      type: String,
      default: ''
    },
    address: {
      street: { type: String, default: '' },
      street2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      zip: { type: String, default: '' },
    },
    locationName: {
      type: String,
      default: ''
    },
    shift: {
      type: String,
      default: ''
    },
    shiftDateAndTimes: {
      type: String,
      default: ''
    },
    timeSheet: {
      content: { type: Buffer, default: '' },
      type: { type: String, default: '' },
      name: { type: String, default: '' },
    },
    jobRating: {
      type: Number,
      default: 0
    },
    payRate: {
      type: String,
      default: ''
    },
    timeSheetTemplate: {
      type: String,
      default: ''
    },
    timeSheetVerified: {
      type: Boolean,
      default: false
    },
    bonus: {
      type: String,
      default: ''
    },
    hours: {
      type: Number,
      default: 0
    },
    isHoursSubmit: {
      type: Boolean,
      default: false
    },
    hoursTimer: {
      type: String,
      default: '',
    },
    hoursComments: {
      type: String,
      default: ''
    },
    hoursDateAndTime: {
      type: Date,
      default: new Date()
    },
    isHoursApproved: {
      type: String,
      default: false
    },
    preTime: {
      type: String,
      default: ''
    },
    lunch: {
      type: String,
      default: ''
    },
    finalHours: {
      type: Number,
      default: 0,
    },
    lunchEquation: {
      type: Number,
      default: 0
    },
    finalHoursEquation: {
      type: Number,
      default: 0
    },
    caregiver: {
      type: String,
      default: 0
    },
    shiftTime: {
      type: String,
      default: ''
    },
    shiftDate: {
      type: String,
      default: ''
    },
    laborState: {
      type: Number,
      default: 0,
    },
    
    shiftStartTime: {
      type: String,
      default: ''
    },
    
    shiftEndTime: {
      type: String,
      default: ''
    },
  });

  schema.method("toJSON", function () {
    const { _id, ...object } = this.toObject();
    object.id = _id;
    return object;
  });


  const Jobs = mongoose.model("Jobs", schema); // Changed model name to "Master"
  return Jobs;
};