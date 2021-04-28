const Usuario = require("../models/Usuario");
const Producto = require("../models/Producto");
const Cliente = require("../models/Cliente");
const Pedido = require("../models/Pedido");

const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");

require("dotenv").config({ path: "variables.env" });

const crearToken = (usuario, secreta, expiresIn) => {
  const { id, email, nombre, apellido } = usuario;
  return jwt.sign({ id, email, nombre, apellido }, secreta, { expiresIn });
};

// Resolvers
const resolvers = {
  Query: {
    obtenerUsuario: async (_, {}, ctx) => {
      return ctx.usuario;
      /*const usuarioId = await jwt.verify(token, process.env.SECRETA);
      return usuarioId;*/
    },
    obtenerProductos: async () => {
      try {
        const productos = await Producto.find({});
        return productos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerProducto: async (_, { id }) => {
      //TODO Producto existe
      const producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }

      return producto;
    },
    obtenerClientes: async () => {
      try {
        const clientes = await Cliente.find({});
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerClientesVendedor: async (_, {}, ctx) => {
      console.log(ctx);
      try {
        const clientes = await Cliente.find({
          vendedor: ctx.usuario.id.toString(),
        });
        return clientes;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerCliente: async (_, { id }, ctx) => {
      //TODO Revisar si el cliente existe o no
      const cliente = await Cliente.findById(id);
      if (!cliente) {
        throw new Error("Cliente no encontrado");
      }

      //TODO Quien lo creo puede verlo
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tiene las credenciales");
      }

      return cliente;
    },
    obtenerPedidos: async () => {
      try {
        const pedidos = await Pedido.find({});
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedidosVendedor: async (_, {}, ctx) => {
      try {
        const pedidos = await Pedido.find({
          vendedor: ctx.usuario.id,
        }).populate("cliente");
        return pedidos;
      } catch (error) {
        console.log(error);
      }
    },
    obtenerPedido: async (_, { id }, ctx) => {
      //TODO Si el pedido existe o no
      const pedido = await Pedido.findByIdAndDelete(id);
      if (!pedido) {
        throw new Error("Pedido no encontrado");
      }

      //TODO Solo quien lo creo puede verlo
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("Acción no permitida");
      }
      //TODO Retorna resultado
      return pedido;
    },
    obtenerPedidoEstado: async (_, { estado }, ctx) => {
      const pedidos = Pedido.find({ vendedor: ctx.usuario.id, estado });

      return pedidos;
    },
    mejoresClientes: async () => {
      const clientes = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$cliente",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "clientes",
            localField: "_id",
            foreignField: "_id",
            as: "cliente",
          },
        },
        {
          $limit: 3,
        },
        {
          $sort: { total: -1 },
        },
      ]);

      return clientes;
    },
    mejoresVendedores: async () => {
      const vendedores = await Pedido.aggregate([
        { $match: { estado: "COMPLETADO" } },
        {
          $group: {
            _id: "$vendedor",
            total: { $sum: "$total" },
          },
        },
        {
          $lookup: {
            from: "usuarios",
            localField: "_id",
            foreignField: "_id",
            as: "vendedor",
          },
        },
        {
          $limit: 3,
        },
        {
          $sort: { total: -1 },
        },
      ]);

      return vendedores;
    },
    buscarProducto: async (_, { texto }) => {
      const productos = await Producto.find({
        $text: { $search: texto },
      }).limit(10);
      return productos;
    },
  },

  Mutation: {
    nuevoUsuario: async (_, { input }) => {
      const { email, password } = input;
      //TODO Revisar si el usuario ya está registrado
      const existeUsuario = await Usuario.findOne({ email });
      if (existeUsuario) {
        throw new Error("El usuario ya está registrado");
      }
      //TODO Hashear su password
      const salt = await bcryptjs.genSalt(10);
      input.password = await bcryptjs.hash(password, salt);

      try {
        //TODO Guardarlo en la base de datos
        const usuario = new Usuario(input);
        usuario.save();
        return usuario;
      } catch (error) {
        console.log(error);
      }
    },
    autenticarUsuario: async (_, { input }) => {
      const { email, password } = input;

      //TODO Si el usuario existe
      const existeUsuario = await Usuario.findOne({ email });
      if (!existeUsuario) {
        throw new Error("El usuario no existe");
      }

      //TODO Si el password es correcto
      const passwordCorrecto = await bcryptjs.compare(
        password,
        existeUsuario.password
      );

      if (!passwordCorrecto) {
        throw new Error("El password es incorrecto");
      }
      //TODO Crear el token
      return {
        token: crearToken(existeUsuario, process.env.SECRETA, "24h"),
      };
    },
    nuevoProducto: async (_, { input }) => {
      try {
        const nuevoProducto = new Producto(input);

        //TODO almacenar en la base de datos
        const resultado = await nuevoProducto.save();
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarProducto: async (_, { id, input }) => {
      //TODO Producto existe
      let producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }

      //TODO Guardar en la base de datos
      producto = await Producto.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return producto;
    },
    eliminarProducto: async (_, { id }) => {
      //TODO Producto existe
      const producto = await Producto.findById(id);
      if (!producto) {
        throw new Error("Producto no encontrado");
      }

      //TODO Eliminar
      await Producto.findOneAndDelete({ _id: id });

      return "Producto eliminado";
    },
    nuevoCliente: async (_, { input }, ctx) => {
      const { email } = input;
      //TODO Verificar si el cliente ya esta registrado
      const cliente = await Cliente.findOne({ email });
      if (cliente) {
        throw new Error("Ese cliente ya esta registrado");
      }

      const nuevoCliente = new Cliente(input);
      //TODO Asignar el vendedor
      nuevoCliente.vendedor = ctx.usuario.id;

      //TODO Guardar en la base de datos
      try {
        const resultado = await nuevoCliente.save();
        return resultado;
      } catch (error) {
        console.log(error);
      }
    },
    actualizarCliente: async (_, { id, input }, ctx) => {
      //TODO Verificar si existe o no
      let cliente = await Cliente.findById(id);

      if (!cliente) {
        throw new Error("Ese cliente no existe");
      }

      //TODO Verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tiene las credenciales");
      }

      //TODO Guardar cliente
      cliente = await Cliente.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return cliente;
    },
    eliminarCliente: async (_, { id, input }, ctx) => {
      //TODO Cliente existe o no
      let cliente = await Cliente.findById(id);

      if (!cliente) {
        throw new Error("Ese cliente no existe");
      }

      //TODO Verificar si el vendedor es quien edita
      if (cliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tiene las credenciales");
      }

      //TODO Eliminar cliente
      await Cliente.findOneAndDelete({ _id: id });
      return "Cliente eliminado";
    },
    nuevoPedido: async (_, { input }, ctx) => {
      const { cliente } = input;
      //TODO Cliente existe o no
      let clienteExiste = await Cliente.findById(cliente);

      if (!clienteExiste) {
        throw new Error("Ese cliente no existe");
      }

      //TODO Verificar si el cliente es del vendedor
      if (clienteExiste.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tiene las credenciales");
      }

      //TODO Revisar que en el stock este disponible
      for await (const articulo of input.pedido) {
        const { id } = articulo;
        const producto = await Producto.findById(id);

        if (articulo.cantidad > producto.existencia) {
          throw new Error(
            `El artículo: ${producto.nombre} excede la cantidad disponible`
          );
        } else {
          //TODO Restar la cantidad a lo disponible
          producto.existencia = producto.existencia - articulo.cantidad;
          await producto.save();
        }
      }

      //TODO Crear un nuevo pedido
      const nuevoPedido = new Pedido(input);

      //TODO Asignar un vendedor
      nuevoPedido.vendedor = ctx.usuario.id;

      //TODO Guardar la base de datos
      const resultado = await nuevoPedido.save();
      return resultado;
    },
    actualizarPedido: async (_, { id, input }, ctx) => {
      const { cliente } = input;
      console.log(cliente, input);
      //TODO Si el pedido existe
      const existePedido = await Pedido.findById(id);
      if (!existePedido) {
        throw new Error("El pedido no existe");
      }

      //TODO Si el cliente existe
      const existeCliente = await Cliente.findById(cliente);
      if (!existeCliente) {
        throw new Error("El cliente no existe");
      }

      //TODO Si el cliente y pedido pertenece al vendedor
      if (existeCliente.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //TODO Revisar el stock
      if (input.pedido) {
        for await (const articulo of input.pedido) {
          const { id } = articulo;
          const producto = await Producto.findById(id);

          if (articulo.cantidad > producto.existencia) {
            throw new Error(
              `El artículo: ${producto.nombre} excede la cantidad disponible`
            );
          } else {
            //TODO Restar la cantidad a lo disponible
            producto.existencia = producto.existencia - articulo.cantidad;
            await producto.save();
          }
        }
      }

      //TODO Guardar el pedido
      const resultado = await Pedido.findOneAndUpdate({ _id: id }, input, {
        new: true,
      });
      return resultado;
    },
    eliminarPedido: async (_, { id }, ctx) => {
      //TODO Verificamos si el pedido existe
      const pedido = await Pedido.findById(id);
      if (!pedido) {
        throw new Error("El pedido no existe");
      }

      //TODO Verificar si el vendedor es quien lo borra
      if (pedido.vendedor.toString() !== ctx.usuario.id) {
        throw new Error("No tienes las credenciales");
      }

      //TODO Eliminar de la base de datos
      await Pedido.findOneAndDelete({ _id: id });
      return "Pedido eliminado";
    },
  },
};

module.exports = resolvers;
