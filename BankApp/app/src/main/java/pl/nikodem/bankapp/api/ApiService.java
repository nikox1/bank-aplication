package pl.nikodem.bankapp.api;

import pl.nikodem.bankapp.models.ApiResponse;
import pl.nikodem.bankapp.models.BlikCode;
import pl.nikodem.bankapp.models.LoginResponse;

import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.POST;

public interface ApiService {

    @POST("api/register")
    Call<LoginResponse> register(@Body Map<String, String> body);

    @POST("api/login")
    Call<LoginResponse> login(@Body Map<String, String> body);

    @GET("api/account/balance")
    Call<LoginResponse> getBalance(@Header("Authorization") String token);

    @POST("api/transfer")
    Call<ApiResponse> transfer(@Header("Authorization") String token, @Body Map<String, Object> body);

    @POST("api/blik/generate")
    Call<BlikCode> generateBlik(@Header("Authorization") String token);

    @GET("api/transactions")
    Call<ApiResponse> getTransactions(@Header("Authorization") String token);
}
