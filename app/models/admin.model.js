module.exports = (mongoose, collectionName) => {
var schema = mongoose.Schema({
    userStatus: {
        type: Boolean,
        default: false
    },
    AId: {
        type: Number,
        unique: true,
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
    email: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    address: {
        street: { type: String, default: '' },
        street2: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        zip: { type: String, default: '' },
    },
    photoImage: {
        content: { type: String, default: '' },
        type: { type: String, default: '' },
        name: { type: String, default: '' }
    },
    logined: {
        type: Boolean,
        default: false
    },
    userStatus: {
        type: String,
        default: 'inactive'
    },
    verifyCode: {
        type: String,
        default: ''
    },
    verifyTime: {
        type: Number,
        default: 0
    },
    shiftType: {
        type: Array,
        default: []
    },
    staffInfo: {
        type: Array,
        default: []
    }
});

schema.method("toJSON", function () {
    const { __v, _id, ...object } = this.toObject();
    object.id = _id;
    return object;
});
schema.index({ email: 1 }); // added indexing
const modelName = collectionName || "Admin";
const Admin = mongoose.model(modelName, schema, collectionName); // Use custom collection name if provided
return Admin;
};
