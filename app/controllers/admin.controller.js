const jwtEncode = require('jwt-encode')
const db = require("../models");
const { setToken } = require('../utils/verifyToken');
const { set } = require('mongoose');
const Admin = db.admins;
const Clinical = db.clinical;
const Bid = db.bids;
const Facility = db.facilities;
const nodemailer = require('nodemailer');
const mailTrans = require("../controllers/mailTrans.controller.js");
const e = require('cors');

const limitAccNum = 100;
const expirationTime = 10000000;
//Register Account
exports.signup = async (req, res) => {
    try {
        console.log("register");
        let response = req.body;
        const isUser = await Admin.findOne({ email: response.email.toLowerCase() });

        if (!isUser) {
            response.email = response.email.toLowerCase();
            response.entryDate = new Date();
            if (response.photoImage.name != "") {
                const content = Buffer.from(response.photoImage.content, 'base64');
                response.photoImage.content = content;
            }
            const auth = new Admin(response);
            await auth.save();
            const payload = {
                email: response.email,
                userRole: response.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
            res.status(201).json({ message: "Successfully Regisetered", token: token });
        } else {
            res.status(409).json({ message: "The Email is already registered" })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}

//Login Account
exports.login = async (req, res) => {
    try {
        console.log("LogIn");
        const { email, password, userRole } = req.body;
        const isUser = await Admin.findOne({ email: email.toLowerCase(), password: password, userRole: userRole });
        if (isUser) {
            if (isUser.userStatus === 'activate') {
                const payload = {
                    email: isUser.email,
                    userRole: isUser.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                }
                const token = setToken(payload);
                console.log(token);
                if (token) {
                    const updateUser = await Admin.updateOne({ email: email.toLowerCase(), userRole: userRole }, { $set: { logined: true } });
                    res.status(200).json({ message: "Successfully Logined!", token: token, user: isUser });
                } else {
                    res.status(400).json({ message: "Cannot logined User!" })
                }
            } else {
                res.status(402).json({message: "You are not approved! Please wait."})
            }
        } else {
            const isExist = await Admin.findOne({ email: email.toLowerCase(), userRole: userRole });

            if (isExist) {
                res.status(401).json({ message: "Login information is incorrect." })
            } else {
                res.status(404).json({ message: "User Not Found! Please Register First." })
            }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

function generateVerificationCode(length = 6) {
    let code = "";
    for (let i = 0; i < length; i++) {
        code += Math.floor(Math.random() * 10); // Generates a random digit (0-9)
    }
    return code;
}
  
exports.forgotPassword = async (req, res) => {
    try {
        console.log("forgotPassword");
        const { email } = req.body;
        // console.log(device, 'dddd');
        const isUser = await Admin.findOne({ email: email });
        if (isUser) {
            const verifyCode = generateVerificationCode();
            const verifyTime = Math.floor(Date.now() / 1000) + 600;
            if (verifyCode && verifyTime) {
                const verifySubject = "BookSmart™ - Your verifyCode here"
                const verifiedContent = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${isUser.firstName},</p>
                    <p>Someone want to change your BookSmart™ account password.</p>
                    <p>Your verifyCode is here: ${verifyCode}</p>
                    <p>For security reasons, do not share this code with anyone.</p>
                </div>`
                
                let approveResult = mailTrans.sendMail(isUser.email, verifySubject, verifiedContent);
                if (approveResult) {
                    const updateUser = await Admin.updateOne({ email: email }, { $set: { verifyCode: verifyCode, verifyTime: verifyTime } });
                    console.log(updateUser);
                    res.status(200).json({ message: "Sucess" });
                }
            }
            else {
                res.status(400).json({message: "Failde to generate VerifyCode. Please try again!"})
            }
        }
        else {
            res.status(404).json({ message: "User Not Found! Please Register First." })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}


exports.verifyCode = async (req, res) => {
    try {
        console.log("verfyCode");
        const { verifyCode } = req.body;
        console.log(verifyCode);
        const isUser = await Admin.findOne({ verifyCode: verifyCode });
        if (isUser) {
            const verifyTime = Math.floor(Date.now() / 1000);
            if (verifyTime > isUser.verifyTime) {
                res.status(401).json({message: "This verifyCode is expired. Please regenerate code!"})
            }
            else {
                res.status(200).json({message: "Success to verify code."})
            }
        }
        else {
            res.status(404).json({ message: "User Not Found! Please Register First." })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

exports.updatePassword = async (req, res) => {
    try {
        const { userId, password, tmpPassword, userRole } = req.body;

        if (userRole == 'Clinician') {
            const isUser = await Clinical.findOne({ aic: userId });
            if (isUser) {
                const updateUser = await Clinical.updateOne({ aic: userId }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
                const verifySubject8 = "Your BookSmart™ Password Has Been Reset"
                const verifiedContent8 = `
                <div id=":15j" class="a3s aiL ">
                    <p>${isUser.firstName} ${isUser.lastName}</p>
                    <p>Your password has been reset!</p>
                    <p><strong>--------------------</strong></p>
                    <p>Login: ${isUser.email}</p>
                    <p>Password: ${tmpPassword}</p>
                    <p><strong>--------------------</strong></p>
                    <p><strong>BOOK SMART</strong></p>
                    <p style="color: red;">(save to favorites or bookmark to Home Screen)</p>
                </div>`
                let approveResult8 = mailTrans.sendMail(isUser.email, verifySubject8, verifiedContent8);
                return res.status(200).json({message: "Password changed successfully."});
            } else {
                return res.status(404).json({ message: "Password change failed." })
            }
        } else if (userRole == 'Facilities') {
            const facility = await Facility.findOne({ aic: userId });
            if (facility) {
                const updateUser = await Facility.updateOne({ aic: userId }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
                const verifySubject8 = "Your BookSmart™ Password Has Been Reset"
                const verifiedContent8 = `
                <div id=":15j" class="a3s aiL ">
                    <p>${facility.firstName} ${facility.lastName}</p>
                    <p>Your password has been reset!</p>
                    <p><strong>--------------------</strong></p>
                    <p>Login: ${facility.contactEmail}</p>
                    <p>Password: ${tmpPassword}</p>
                    <p><strong>--------------------</strong></p>
                    <p><strong>BOOK SMART</strong></p>
                    <p style="color: red;">(save to favorites or bookmark to Home Screen)</p>
                </div>`
                let approveResult8 = mailTrans.sendMail(facility.contactEmail, verifySubject8, verifiedContent8);
                return res.status(200).json({message: "Password changed successfully."});
            } else {
                return res.status(404).json({ message: "Password change failed." })
            }
        }

    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
};

exports.resetPassword = async (req, res) => {
    try {
        console.log("verfyCode");
        const { email, password } = req.body;
        const isUser = await Admin.findOne({ email: email });
        if (isUser) {
            const updateUser = await Admin.updateOne({ email: email }, { $set: { password: password, verifyTime: 0, verifyCode: '' } });
            console.log(updateUser);
            res.status(200).json({message: "Password changed successfully."})
        }
        else {
            res.status(404).json({ message: "Password change failed." })
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

function extractNonJobId(job) {
    const keys = Object.keys(job);
    console.log(keys);
    
    // Filter out the key 'email'
    const nonJobIdKeys = keys.filter(key => key !== 'contactEmail');
    console.log(nonJobIdKeys);
    
    // Create a new object with the non-email properties
    const newObject = {};
    nonJobIdKeys.forEach(key => {
        newObject[key] = job[key]; // Copy each property except 'email'
    });
    
    return newObject;
}

exports.Update = async (req, res) => {
    let request = req.body;
    const user = req.user;

    if (request.photoImage.name != "") {
        const content = Buffer.from(request.photoImage.content, 'base64');
        request.photoImage.content = content;
    }

    if (user) {
        Admin.findOneAndUpdate({ user } ,{ $set: request }, { new: false }, async (err, updatedDocument) => {
            if (err) {
                return res.status(500).json({ error: err });
            } else {
                const payload = {
                    email: user.email,
                    userRole: user.userRole,
                    iat: Math.floor(Date.now() / 1000), // Issued at time
                    exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                }
                const token = setToken(payload);
                const users = await Admin.findOne({email: request.email})
                if (users) {
                    return res.status(200).json({ message: 'Updated', token: token, user: users });
                } else {
                    return res.status(500).json({ message: 'Not Exist', token: token, user: users });
                }
            }
        })
    }
}

//Get All Data
exports.admin = async (req, res) => {
    try {
        // console.log("shifts");
        const user = req.user;
        const role = req.headers.role;
        // console.log('role------', req.headers.role);
        const data = await Admin.find({});
        // console.log("data---++++++++++++++++++++++++>", data)
        let dataArray = [];
        if (role === 'Admin') {
            data.map((item, index) => {
                dataArray.push([
                item.phone,
                item.firstName,
                item.lastName,
                item.companyName,
                item.email,
                item.userStatus,
                item.userRole])
            })
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
        // console.log('token----------------------------------------------------->',token);
        if (token) {
            // const updateUser = await Job.updateOne({email: email, userRole: userRole}, {$set: {logined: true}});
            res.status(200).json({ message: "Successfully Get!", jobData: dataArray, token: token });
        }
        else {
            res.status(400).json({ message: "Cannot logined User!" })
        }
        }
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" })
    }
}

function extractNonJobId(job, mail) {
    const keys = Object.keys(job);
    console.log(keys);
    
    // Filter out the key 'email'
    const nonJobIdKeys = keys.filter(key => key !== mail);
    console.log(nonJobIdKeys);
    
    // Create a new object with the non-email properties
    const newObject = {};
    nonJobIdKeys.forEach(key => {
        newObject[key] = job[key]; // Copy each property except 'email'
    });
    
    return newObject;
}

exports.updateUserInfo = async (req, res) => {
    const email = req.body.userEmail;
    const userRole = req.body.userRole;
    const status = req.body.status;
    const password = req.body.password;

    if (userRole === 'Admin') {
        const adminUser = await Admin.findOne({ email });

        await Admin.updateOne({ email }, {$set: { userStatus: status }});

        if (password != '') {
            await Admin.updateOne({ email }, {$set: { password }});
            const verifySubject7 = "BookSmart™ - Your password has been changed"
            const verifiedContent7 = `
            <div id=":15j" class="a3s aiL ">
                <p>Hello ${adminUser.firstName},</p>
                <p>Your BookSmart™ account password has been chnaged.</p>
                <p>Your password is <b>${password}</b></p>
            </div>`
            let approveResult7 = mailTrans.sendMail(updatedDocument.email, verifySubject7, verifiedContent7);
        }

        if (adminUser.userStatus != status) {
            if (status == 'activate') {
                const verifySubject8 = "BookSmart™ - Your Account Approval"
                const verifiedContent8 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${adminUser.firstName},</p>
                    <p>Your BookSmart™ account has been approved. To login please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw1QDW3VkX4lblO8gh8nfIYo">https://app.whybookdumb.com/<wbr>bs/#home-login</a></p>
                    <p>To manage your account settings, please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login/knack-account" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login/knack-account&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw3TA8pRD_CD--MZ-ls68oIo">https://app.whybookdumb.com/<wbr>bs/#home-login/knack-account</a></p>
                </div>`
                let approveResult8 = mailTrans.sendMail(adminUser.email, verifySubject8, verifiedContent8);
            } else {
                const verifySubject9 = "BookSmart™ - Your Account Restricted"
                const verifiedContent9 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${adminUser.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult9 = mailTrans.sendMail(adminUser.email, verifySubject9, verifiedContent9);
            }
        }
    } else if (userRole === 'Clinician') {
        const clientUser = await Clinical.findOne({ email });

        await Clinical.updateOne({ email }, {$set: { userStatus: status }});

        if (password != '') {
            await Clinical.updateOne({ email }, {$set: { password }});

            console.log(email, password, clientUser);
            const verifySubject1 = "BookSmart™ - Your password has been changed"
            const verifiedContent1 = `
            <div id=":15j" class="a3s aiL ">
                <p>Hello ${clientUser.firstName},</p>
                <p>Your BookSmart™ account password has been chnaged.</p>
                <p>Your password is <b>${password}</b></p>
            </div>`
            let approveResult1 = mailTrans.sendMail(clientUser.email, verifySubject1, verifiedContent1);
        }

        if (clientUser.userStatus != status) {
            if (status == 'activate') {
                const verifySubject2 = "BookSmart™ - Your Account Approval"
                const verifiedContent2 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${clientUser.firstName},</p>
                    <p>Your BookSmart™ account has been approved. To login please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw1QDW3VkX4lblO8gh8nfIYo">https://app.whybookdumb.com/<wbr>bs/#home-login</a></p>
                    <p>To manage your account settings, please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login/knack-account" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login/knack-account&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw3TA8pRD_CD--MZ-ls68oIo">https://app.whybookdumb.com/<wbr>bs/#home-login/knack-account</a></p>
                </div>`
                let approveResult2 = mailTrans.sendMail(clientUser.email, verifySubject2, verifiedContent2);
            } else {
                const verifySubject3 = "BookSmart™ - Your Account Restricted"
                const verifiedContent3 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${clientUser.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult3 = mailTrans.sendMail(clientUser.email, verifySubject3, verifiedContent3);
            }
        }
    } else if (userRole === 'Facilities') {
        const facilityUser = await Facility.findOne({ contactEmail: email });

        await Facility.updateOne({ contactEmail: email }, {$set: { userStatus: status }});

        if (password != '') {
            await Facility.updateOne({ contactEmail: email }, {$set: { password }});
            const verifySubject4 = "BookSmart™ - Your password has been changed"
            const verifiedContent4 = `
            <div id=":15j" class="a3s aiL ">
                <p>Hello ${facilityUser.firstName},</p>
                <p>Your BookSmart™ account password has been chnaged.</p>
                <p>Your password is <b>${password}</b></p>
            </div>`
            let approveResult4 = mailTrans.sendMail(facilityUser.contactEmail, verifySubject4, verifiedContent4);
        }

        if (facilityUser.userStatus != status) {
            if (status == 'activate') {
                const verifySubject5 = "BookSmart™ - Your Account Approval"
                const verifiedContent5 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${facilityUser.firstName},</p>
                    <p>Your BookSmart™ account has been approved. To login please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw1QDW3VkX4lblO8gh8nfIYo">https://app.whybookdumb.com/<wbr>bs/#home-login</a></p>
                    <p>To manage your account settings, please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login/knack-account" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login/knack-account&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw3TA8pRD_CD--MZ-ls68oIo">https://app.whybookdumb.com/<wbr>bs/#home-login/knack-account</a></p>
                </div>`
                let approveResult5 = mailTrans.sendMail(facilityUser.contactEmail, verifySubject5, verifiedContent5);
            } else {
                const verifySubject6 = "BookSmart™ - Your Account Restricted"
                const verifiedContent6 = `
                <div id=":15j" class="a3s aiL ">
                    <p>Hello ${facilityUser.firstName},</p>
                    <p>Your BookSmart™ account has been restricted.</p>
                </div>`
                let approveResult6 = mailTrans.sendMail(facilityUser.contactEmail, verifySubject6, verifiedContent6);
            }
        }
    }
    return res.status(200).json({ message: 'User information has been updated' });
};

//Update Users Account
exports.UpdateUser = async (req, res) => {
    console.log('updateSignalUser');
    const request = req.body;
    const user = req.user;
    console.log("user", request);
    const userRole = request.updateData.userRole;
    const fakeUserRole = request.userRole;
    if (userRole === fakeUserRole) {
        if (userRole === 'Admin') {
            const extracted = extractNonJobId(request.updateData, 'email');
            console.log(extracted, "Extracted")
            if (extracted.updateEmail) {
               extracted.email =extracted.updateEmail; // Create the new property
               delete extracted.updateEmail;
            }
            Admin.findOneAndUpdate({ email: request.updateData.email, userRole: 'Admin' }, { $set: extracted}, { new: false }, async (err, updatedDocument) => {
                if (err) {
                    // Handle the error, e.g., return an error response
                    res.status(500).json({ error: err });
                    console.log(err);
                } else {
                    console.log("updated", updatedDocument);
                    const payload = {
                        email: user.email,
                        userRole: user.userRole,
                        iat: Math.floor(Date.now() / 1000), // Issued at time
                        exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                    }
                    const token = setToken(payload);
                    console.log(token);
                    const users = await Admin.findOne({email: extracted.email})
                    console.log(users);
                    if (extracted.userStatus == 'activate') {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Approval"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been approved. To login please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw1QDW3VkX4lblO8gh8nfIYo">https://app.whybookdumb.com/<wbr>bs/#home-login</a></p>
                            <p>To manage your account settings, please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login/knack-account" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login/knack-account&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw3TA8pRD_CD--MZ-ls68oIo">https://app.whybookdumb.com/<wbr>bs/#home-login/knack-account</a></p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.email, verifySubject, verifiedContent);
                    }
                    else if (extracted.userStatus == "inactivate") {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Restricted"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been restricted.</p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.email, verifySubject, verifiedContent);
                    }
                    // Document updated successfully, return the updated document as the response
                    res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: users });
                }
            })        
        } else if (userRole === 'Facilities') {
            const extracted = extractNonJobId(request.updateData, 'contactEmail');
            if (extracted.updateEmail) {
                extracted.contactEmail =extracted.updateEmail; // Create the new property
                delete extracted.updateEmail;
             }
            console.log(extracted, userRole)
            Facility.findOneAndUpdate({ contactEmail: request.updateData.contactEmail, userRole: 'Facilities' }, { $set: extracted}, { new: false }, async (err, updatedDocument) => {
                if (err) {
                    // Handle the error, e.g., return an error response
                    res.status(500).json({ error: err });
                    console.log(err);
                } else {
                    // console.log("updated", updatedDocument);
                    const payload = {
                        email: user.email,
                        userRole: user.userRole,
                        iat: Math.floor(Date.now() / 1000), // Issued at time
                        exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                    }
                    const token = setToken(payload);
                    const users = await Facility.findOne({email: extracted.email})
                    console.log('success');
                    if (extracted.userStatus == 'activate') {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Approval"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been approved. To login please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw1QDW3VkX4lblO8gh8nfIYo">https://app.whybookdumb.com/<wbr>bs/#home-login</a></p>
                            <p>To manage your account settings, please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login/knack-account" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login/knack-account&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw3TA8pRD_CD--MZ-ls68oIo">https://app.whybookdumb.com/<wbr>bs/#home-login/knack-account</a></p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.contactEmail, verifySubject, verifiedContent);
                    }
                    else if (extracted.userStatus == "inactivate") {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Restricted"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been restricted.</p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.contactEmail, verifySubject, verifiedContent);
                    }
                    // Document updated successfully, return the updated document as the response
                    res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: users });
                }
            })        
        } else if (userRole === 'Clinician') {
            const extracted = extractNonJobId(request.updateData, 'email');
            if (extracted.updateEmail) {
               extracted.email =extracted.updateEmail; // Create the new property
               delete extracted.updateEmail;
            }
            console.log(extracted, userRole)
            Clinical.findOneAndUpdate({ email: request.updateData.email, userRole: 'Clinician' }, { $set: extracted}, { new: false }, async (err, updatedDocument) => {
                if (err) {
                    // Handle the error, e.g., return an error response
                    res.status(500).json({ error: err });
                    console.log(err);
                } else {
                    // console.log("updated", updatedDocument);
                    const payload = {
                        email: user.email,
                        userRole: user.userRole,
                        iat: Math.floor(Date.now() / 1000), // Issued at time
                        exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
                    }
                    const token = setToken(payload);
                    const users = await Admin.findOne({email: extracted.email})
                    console.log(token);
                    if (extracted.userStatus == 'activate') {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Approval"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been approved. To login please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw1QDW3VkX4lblO8gh8nfIYo">https://app.whybookdumb.com/<wbr>bs/#home-login</a></p>
                            <p>To manage your account settings, please visit the following link:<br><a href="https://app.whybookdumb.com/bs/#home-login/knack-account" target="_blank" data-saferedirecturl="https://www.google.com/url?q=https://app.whybookdumb.com/bs/%23home-login/knack-account&amp;source=gmail&amp;ust=1721895769161000&amp;usg=AOvVaw3TA8pRD_CD--MZ-ls68oIo">https://app.whybookdumb.com/<wbr>bs/#home-login/knack-account</a></p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.email, verifySubject, verifiedContent);
                    }
                    else if (extracted.userStatus == "inactivate") {
                        console.log('Activated .........');
                        const verifySubject = "BookSmart™ - Your Account Restricted"
                        const verifiedContent = `
                        <div id=":15j" class="a3s aiL ">
                            <p>Hello ${updatedDocument.firstName},</p>
                            <p>Your BookSmart™ account has been restricted.</p>
                        </div>`
                        let approveResult = mailTrans.sendMail(updatedDocument.email, verifySubject, verifiedContent);
                    }
                    // Document updated successfully, return the updated document as the response
                    res.status(200).json({ message: 'Trading Signals saved Successfully', token: token, user: users });
                }
            })        
        }
    } 
    else {
        if (userRole === 'Admin') {
            const auth = new Admin(request.updateData);
            console.log(auth, userRole)
            let phone = '';
            let password = '';
            if (fakeUserRole === 'Facilities') {
                const result = await Facility.findOne({ contactEmail: auth.email });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    phone = result.contactPhone;
                }
            } else {
                const result = await Clinical.findOne({ email: auth.email });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    phone = result.phoneNumber;
                    console.log('++++++++++++++++++', password, phone);
                }
            }
            auth.phone=phone;
            auth.password = password;
            auth.save();
            if (fakeUserRole === 'Facilities') {
                const result = await Facility.deleteOne({ contactEmail: auth.email });
            } else {
                const result = await Clinical.deleteOne({ email: auth.email });
            }
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
            console.log(token, "--3-3-3-3--3-3-3--3-3-3-");
            res.status(200).json({ message: 'Trading Signals saved Successfully', token: token});
        } else if (userRole === 'Facilities') {
            console.log('Facility-------------------------------');
            const auth = new Facility(request.updateData);
            let contactPhone = '';
            let password = '';
            if (fakeUserRole === 'Admin') {
                const result = await Admin.findOne({ email: auth.contactEmail });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    contactPhone = result.phone;
                }
            } else {
                const result = await Clinical.findOne({ email: auth.contactEmail });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    contactPhone = result.phoneNumber;
                    console.log('++++++++++++++++++', password, contactPhone);
                }
            }
            // auth.email=auth.contactEmail
            auth.contactPhone=contactPhone;
            auth.password = password;

            console.log(auth, userRole)
            await auth.save();
            if (fakeUserRole === 'Admin') {
                const result = await Admin.deleteOne({ email: auth.contactEmail });
            } else {
                const result = await Clinical.deleteOne({ email: auth.contactEmail });
            }
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
            console.log(token, "--3-3-3-3--3-3-3--3-3-3-");
            res.status(200).json({ message: 'Trading Signals saved Successfully', token: token});
        } else if (userRole === 'Clinician') {
            let auth = new Clinical(request.updateData);
            let phone = '';
            let password = '';
            if (fakeUserRole === 'Facilities') {
                const result = await Facility.findOne({ contactEmail: auth.email });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    phone = result.contactPhone;
                }
                // auth.email=auth.contactEmail
                console.log('++++++++++++++++++', password, phone);
            } else {
                const result = await Admin.findOne({ email: auth.email });
                console.log( '0-0-0-0-0-0-0-',result);
                if (result) {
                    password = result.password;
                    phone = result.phone;
                }
            }
            auth.phoneNumber=phone;
            auth.password = password;
            console.log(auth, userRole)
            await auth.save();
            if (fakeUserRole === 'Facilities') {
                const result = await Facility.deleteOne({ contactEmail: auth.email });
            } else {
                const result = await Admin.deleteOne({ email: auth.email });
            }
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
            console.log(token, "--3-3-3-3--3-3-3--3-3-3-");
            res.status(200).json({ message: 'Trading Signals saved Successfully', token: token});
        }
        else {
            const payload = {
                email: user.email,
                userRole: user.userRole,
                iat: Math.floor(Date.now() / 1000), // Issued at time
                exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
            }
            const token = setToken(payload);
            console.log(token, "--3-3-3-3--3-3-3--3-3-3-");
            res.status(200).json({ message: 'Trading Signals saved Successfully', token: token});
        }

    }
}

exports.getBidIDs = async (req, res) => {
    try {
        const user = req.user;
        
        // Find clinical and facility data
        const bidders = await Bid.find({});
    
        // Combine the names into one array
        const bidList = [
            ...bidders.map(item => item.bidId),
        ];

        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + expirationTime
        }
        const token = setToken(payload);
    
        return res.status(200).json({ message: "success", bidList, token });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occurred!" });
    }
};

exports.getAllUsersName = async (req, res) => {
    try {
        const user = req.user;
        
        // Find clinical and facility data
        const clinicals = await Clinical.find({}, { firstName: 1, lastName: 1, _id: 0 });
        const facilities = await Facility.find({}, { firstName: 1, lastName: 1, _id: 0 });
    
        // Combine the names into one array
        const combinedNames = [
            ...clinicals.map(clinical => `${clinical.firstName} ${clinical.lastName}`),
            ...facilities.map(facility => `${facility.firstName} ${facility.lastName}`)
        ];
    
        // Sort the combined names alphabetically
        combinedNames.sort((a, b) => a.localeCompare(b));

        const payload = {
            email: user.email,
            userRole: user.userRole,
            iat: Math.floor(Date.now() / 1000), // Issued at time
            exp: Math.floor(Date.now() / 1000) + expirationTime // Expiration time
        }
        const token = setToken(payload);
    
        return res.status(200).json({ message: "success", userList: combinedNames, token });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occurred!" });
    }
};

//Logout Account
exports.logout = async (req, res) => {
    try {
        console.log('Logout');
        const email = req.body;
        const logoutUser = await Auth.updateOne({ accountId: accountId }, { $set: { logined: false } });
        res.status(200).json({ email: email, logined: logined })
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
}


exports.removeAccount = async (req, res) => {
    try {
        const { email, role } = req.body;

        if (role == 'Admin') {
            await Admin.deleteOne({ email: email });
        } else if (role == 'Clinician') {
            await Clinical.deleteOne({ email: email });
        } else if(role == 'Facilities') {
            await Facility.deleteOne({ contactEmail: email });
        }
        return res.status(200).json({ message: "Success" });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ message: "An Error Occured!" });
    }
};