module.exports = mongoose => {
    var schema = mongoose.Schema({
      bidId: {
        type: Number,
        required: true,
        unique: true
      },
      entryDate: {
        type: String,
        default: ''
      },
      jobId: {
        type: Number,
        required: true,
      },
      message: {
        type: String,
        default: ''
      },
      bidStatus: {
        type: String,
        default: 'Not Awarded'
      },
      caregiver: {
        type: String,
        default: '',
        required: true,
      },
      Account: {
        type: String,
        default: ''
      },
      facility: {
        type: String,
        default: '',
        required: true
      },
    });
  
    schema.method("toJSON", function () {
      const { _id, ...object } = this.toObject();
      object.id = _id;
      return object;
    });
  
  
    const BidOffer = mongoose.model("BidOffer", schema); // Changed model name to "Master"
    return BidOffer;
  };