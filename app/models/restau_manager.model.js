module.exports = mongoose => {
    var schema = mongoose.Schema({
        aic: {
            type: Number,
        },
        userStatus: {
            type: String,
            default: 'activate'
        },
        userRole: {
            type: String,
            default: '',
        },
        entryDate: {
            type: Date,
            default: Date.now,
        },
        companyName: {
            type: String,
            default: '',
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
            required: true,
        },
        contactPhone: {
            type: String,
            default: '',
            required: true,
        },
        password: {
            type: String,
            default: '',
            required: true,
        },
        contactPassword: {
            type: String,
            default: ''
        },
        AcknowledgeTerm: {
            type: Boolean,
            default: false
        },
        selectedoption: {
            type: String,
        },
        signature: {
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
        avatar: {
            content: { type: String, default: '' },
            type: { type: String, default: '' },
            name: { type: String, default: '' }
        },
        verifyCode: {
          type: String,
          default: ''
        },
        verifyTime: {
          type: Number,
          default: 0
        }
    });

    schema.method("toJSON", function () {
        const { __v, _id, ...object } = this.toObject();
        object.id = _id;
        return object;
    });

    schema.index({ contactEmail: 1 }); // added indexing

    const Restau_Manager = mongoose.model("Restau_Manager", schema);
    return Restau_Manager;
};
