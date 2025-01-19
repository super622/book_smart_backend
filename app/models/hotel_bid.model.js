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
        caregiverId: {
            type: Number,
            default: 0
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
        facilityId: {
            type: Number,
            default: 0
        }
    });
  
    schema.method("toJSON", function () {
        const { _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });
  
    const Hotel_Bid = mongoose.model("Hotel_Bid", schema);
    return Hotel_Bid;
};