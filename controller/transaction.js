import { StatusTransaction } from "@prisma/client";
import snap from "../config/midtrans.config.js"
import { GeneratorOrderId } from "../lib/generatorOrderId.js";
import prisma from "../config/prisma.config.js";



export const CreateTranslation = async (req, res, next) => {
    const { user_id} = req.body

    try {

    const dataUser = await prisma.user.findUnique({
        where: {
            id: user_id
        }
    })
    


    const cart = await prisma.cartItems.findMany({
        where: {
            userID: parseInt(dataUser.id)
        },
        include: {
            product: true
        }
    })

    let gross_amount=0 
    
    cart.forEach((cart) => {
        gross_amount += cart.total * cart.product.harga
    })


    const respData = await prisma.$transaction(async (tx) => {
        const orderData = await tx.order.create({
            data: {
                id: GeneratorOrderId(),
                userID: dataUser.id,
                grossAmount: gross_amount + (gross_amount * 0.11),
            }
        })


        cart.map(async (item) => {
            await tx.orderItems.create({
                data: {
                    orderID: orderData.id,
                    productID: item.productID,
                    total: item.total,
                }
            })
     



        })
        
        const itemsData = cart.map((item) => {
            return {
                "id": item.productID,
                "price": item.product.harga,
                "quantity": item.total,
                "name": item.product.namaProduk,
            }
        })

        let parameter = {
            "transaction_details": {
                "order_id": orderData.id,
                "gross_amount": gross_amount + (gross_amount * 0.11)
            },
            "item_details": [
                ...itemsData,
                {
                    "name": "Tax",
                    "price": gross_amount * 0.11,
                    "quantity": 1,
                    "id": "T01"
                },
            ],
            "customer_details": {
                "username": dataUser.nama,
                "email": dataUser.email,
                "address": dataUser.address,
                "billing_address": {
                    "username": dataUser.nama,
                    "email": dataUser.email,
                    "address": dataUser.address,
                },
                "shipping_address": {
                    "username": dataUser.nama,
                    "email": dataUser.email,
                    "address": dataUser.address,
                }
            },
            "enabled_payments": ["credit_card", "mandiri_clickpay", "cimb_clicks","bca_klikbca", "bca_klikpay", "bri_epay", "echannel", "indosat_dompetku","mandiri_ecash", "permata_va", "bca_va", "bni_va", "other_va", "gopay","kioson", "indomaret", "gci", "danamon_online"],
            "credit_card": {
                "secure": true,
                "bank": "bca",
                "installment": {
                    "required": false,
                    "terms": {
                        "bni": [3, 6, 12],
                        "mandiri": [3, 6, 12],
                        "cimb": [3],
                        "bca": [3, 6, 12],
                        "offline": [6, 12]
                    }
                },
                "whitelist_bins": [
                    "48111111",
                    "41111111"
                ]
            },
            "bca_va": {
                "va_number": "12345678911",
                "free_text": {
                    "inquiry": [
                        {
                            "en": "text in English",
                            "id": "text in Bahasa Indonesia"
                        }
                    ],
                    "payment": [
                        {
                            "en": "text in English",
                            "id": "text in Bahasa Indonesia"
                        }
                    ]
                }
            },
            "bni_va": {
                "va_number": "12345678"
            },
            "permata_va": {
                "va_number": "1234567890",
                "recipient_name": "Bimo Ak"
            },
            "callbacks": {
                "finish": "https://demo.midtrans.com",

            },
            // "expiry": {
            //     "start_time": "2025-12-20 18:11:08 +0700",
            //     "unit": "hours",
            //     "duration": 1440
            // },
            // "custom_field1": "custom field 1 content",
            // "custom_field2": "custom field 2 content",
            // "custom_field3": "custom field 3 content"
        };

     
  
    const transaction = await snap.createTransaction(parameter);

   
    console.log(transaction);
    const transactionData = await prisma.transaction.create({
        data: {
            orderID: orderData.id,
            status: StatusTransaction.PENDING,
            userId: dataUser.id,
            paymentUrl: transaction.redirect_url
        }
    })

    await prisma.cartItems.deleteMany({
        where: {
            userID: dataUser.id
        }
    })


        return {
            
            data: {
                paymentUrl: transaction.redirect_url,
                ...orderData,
            }
        }
            
        
                
    })


    
    res.status(200).json(respData)
   
        
    } catch (error) {
        res.status(500).json({message: error.message})
    }
}

export const WebHookMidtrans =  async (req, res, next) => {
    const { 
        currency,
        fraud_status,
        gross_amount,
        order_id,
        payment_type,
        status_code,
        status_message,
        transaction_id,
        transaction_status,
        transaction_time,
        va_numbers
    } = req.body;


    const statusResponse = await snap.transaction.notification(req.body)


    let orderId = statusResponse.order_id;
        let transactionStatus = statusResponse.transaction_status;
        let fraudStatus = statusResponse.fraud_status;

        console.log(`Transaction notification received. Order ID: ${orderId}. Transaction status: ${transactionStatus}. Fraud status: ${fraudStatus}`);

        // Sample transactionStatus handling logic

        if (transactionStatus == 'capture'){
            // capture only applies to card transaction, which you need to check for the fraudStatus
            if (fraudStatus == 'challenge'){
                // TODO set transaction status on your databaase to 'challenge'
            } else if (fraudStatus == 'accept'){
                // TODO set transaction status on your databaase to 'success'
                 await prisma.transaction.update({
                    where: {
                        orderID: order_id
                    }, 
                    data : {
                        status: StatusTransaction.SUCCESS
                    }
                })
            }
        } else if (transactionStatus == 'settlement'){
            // TODO set transaction status on your databaase to 'success'
            await prisma.transaction.update({
                where: {
                    orderID: order_id
                }, 
                data : {
                    status: StatusTransaction.SUCCESS
                }
            })
        } else if (transactionStatus == 'deny'){
            // TODO you can ignore 'deny', because most of the time it allows payment retries
            await prisma.transaction.update({
                where: {
                    orderID: order_id
                }, 
                data : {
                    status: StatusTransaction.DECLINED
                }
            })
            // and later can become success
        } else if (transactionStatus == 'cancel' ||
          transactionStatus == 'expire'){
            // TODO set transaction status on your databaase to 'failure'
            await prisma.transaction.update({
                where: {
                    orderID: order_id
                }, 
                data : {
                    status: StatusTransaction.EXPIRED
                }
            })
        } else if (transactionStatus == 'pending'){
            // TODO set transaction status on your databaase to 'pending' / waiting payment
        }
}