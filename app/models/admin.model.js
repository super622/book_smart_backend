module.exports = mongoose => {
  var schema = mongoose.Schema({
      userStatus: {
          type: Boolean,
          default: false
      },
      userRole: {
          type: String,
          default: '',
      }
      ,
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
          content: { type: Buffer, default: '' },
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
      }
  });

  schema.method("toJSON", function () {
      const { __v, _id, ...object } = this.toObject();
      object.id = _id;
      return object;
  });

  const Admin = mongoose.model("Admin", schema);
  return Admin;
};
