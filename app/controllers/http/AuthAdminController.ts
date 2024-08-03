import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Admin from "App/models/Admin";
import Hash from '@ioc:Adonis/Core/Hash'
import { schema, rules } from '@ioc:Adonis/Core/Validator'
import { formatErrorMessage, formatSuccessMessage } from 'App/helpers/utils';


export default class AuthAdminController {


    private async validate(request) {
        const transactionSchema = schema.create({
            password: schema.string([
                rules.minLength(4)
            ]),
            email: schema.string([
                rules.email()
            ]),
        })
        const messages = {
            required: 'The {{ field }} is required.'
        }
        await request.validate({ schema: transactionSchema, messages });
    }


    public async create({ request, response, auth }: HttpContextContract) {
        try {
            const data = request.body();
            await this.validate(request)

            const user = auth.use('admin').user ?? '';
            if (!user)
                throw new Error('Authentication error!')

            if (user.type !== 'SUPER_ADMIN')
                throw new Error('Not authorized!')

            let result = await Admin.create({
                type: data.type,
                email: data.email,
                password: data.password,
            });

            if (result !== null) {
                response.status(200).json({ data: "Admin created!" });
            } else {
                throw new Error("Action failed!");
            }

        } catch (error) {
            response.status(400).json(await formatErrorMessage(error))
        }
    }

    public async login({ auth, request, response }: HttpContextContract) {
        try {
            const email = request.input('email')
            const password = request.input('password')

            const admin = await Admin.findByOrFail('email', email)

            if (admin.isBlocked)
                throw new Error('Account blocked!')

            const token = await auth.use('admin').attempt(email, password)
            response.status(200).json({ data: token })

        } catch (error) {
            response.status(400).json(await formatErrorMessage(error))
        }
    }

    public async viewLoggedInAdmin({ response, auth }: HttpContextContract) {
        try {

            const user = auth.use('admin').user ?? '';
            if (!user)
                throw new Error('Authentication error!')

            response.status(200).json({ user });
        } catch (error) {
            response.status(400).json(await formatErrorMessage(error))
        }
    }

    public async viewAllAdmins({ auth, response }: HttpContextContract) {
        try {
            const user = auth.use('admin').user ?? '';
            if (!user)
                throw new Error('Authentication error!')

            if (user.type !== 'SUPER_ADMIN')
                throw new Error('Not authorized!')

            let data = await Admin.query()
            response.status(200).json({ data });
        } catch (error) {
            response.status(400).json(await formatErrorMessage(error))
        }
    }

    public async blockAdmin({ response, auth, params }: HttpContextContract) {
        try {
            const user = auth.use('admin').user ?? '';
            if (!user)
                throw new Error('Authentication error!')

            if (user.type !== 'SUPER_ADMIN')
                throw new Error('Not authorized!')

            let result = await Admin.query()
                .where('unique_id', params.adminId)
                .update({ is_blocked: true })

            if (result === null) {
                throw new Error("Action failed!");
            } else {
                response.status(200).json(await formatSuccessMessage("Account blocked.",null));
            }
        } catch (error) {
            response.status(400).json(await formatErrorMessage(error))
        }
    }

    public async unblockAdmin({ response, auth, params }: HttpContextContract) {
        try {
            const user = auth.use('admin').user ?? '';
            if (!user)
                throw new Error('Authentication error!')

            if (user.type !== 'SUPER_ADMIN')
                throw new Error('Not authorized!')

            let result = await Admin.query()
                .where('unique_id', params.adminId)
                .update({ is_blocked: false })

            if (result === null) {
                throw new Error("Action failed!");
            } else {
                response.status(200).json(await formatSuccessMessage("Account unblocked.",null));
            }
        } catch (error) {
            response.status(400).json(await formatErrorMessage(error))
        }
    }

    public async updateLoggedInAdmin({ response, request, auth }: HttpContextContract) {
        try {
            const data = request.body();

            const user = auth.use('admin').user ?? '';
            if (!user)
                throw new Error('Authentication error!')

            let result = await Admin.query()
                .where('unique_id', user.uniqueId)
                .update({ password: await Hash.make(data.password) })

            if (result === null) {
                throw new Error("Action failed!");
            } else {
                response.status(200).json(await formatSuccessMessage("Profile Updated.",null));
            }
        } catch (error) {
            response.status(400).json(await formatErrorMessage(error))
        }
    }

}


